import Fastify, {
    FastifyInstance,
    FastifyRequest,
    FastifyReply,
} from "fastify";
import Joi, { Schema } from "joi";
import {
    ITypeDefinition,
    IServiceDefinition,
    IEnumDefinition,
    IEndpointDefinition,
    HttpMethod,
    IType,
    IParameterType,
    PrimitiveType,
    IArgumentDefinition,
} from "conjure-api";
import {
    ConjureErrorType,
    ConjureError,
    isConjureError,
} from "conjure-client";


function getDefaultHandler() {
    throw new ConjureError(ConjureErrorType.Other, null, 500, { error: "Not implemented" });
}

function buildRoute(endpointDef: IEndpointDefinition) {
    const urlParameterRegex = /\{[^\}]+\}/;
    let path = endpointDef.httpPath;
    const pathArguments = endpointDef.args.filter((arg) => arg.paramType.type === "path");
    pathArguments.forEach((pathArg) => {
        path = path.replace(urlParameterRegex, `:${pathArg.argName}`);
    });

    return path;
}

export class ConjureServer {
    private fastify: FastifyInstance = Fastify();

    constructor() { }

    // this is an extra "middleware"
    private _addValidator(
        typeDefs: Array<ITypeDefinition>
    ) {
        const typeValidatorSchema: Map<string, Schema> = new Map<string, Schema>();
        // add primitive
        typeValidatorSchema.set(PrimitiveType.ANY, Joi.any());
        typeValidatorSchema.set(PrimitiveType.BEARERTOKEN, Joi.string());
        typeValidatorSchema.set(PrimitiveType.BINARY, Joi.binary());
        typeValidatorSchema.set(PrimitiveType.BOOLEAN, Joi.boolean());
        typeValidatorSchema.set(PrimitiveType.DATETIME, Joi.date());
        typeValidatorSchema.set(PrimitiveType.DOUBLE, Joi.number());
        typeValidatorSchema.set(PrimitiveType.INTEGER, Joi.number().integer());
        typeValidatorSchema.set(PrimitiveType.RID, Joi.string().allow(""));
        typeValidatorSchema.set(PrimitiveType.SAFELONG, Joi.number());
        typeValidatorSchema.set(PrimitiveType.STRING, Joi.string().allow(""));
        typeValidatorSchema.set(PrimitiveType.UUID, Joi.string().uuid());
        
        const generateEnumValidatorSchema = (type: IEnumDefinition): Schema => {
            return Joi.string().valid(...type.values.map((v) => v.value));
        };

        const getReferenceValidatorSchema = (referenceName: string): Schema => {
            typeDefs.forEach((typeDef) => {
                if (ITypeDefinition.isAlias(typeDef)) {
                    if(typeDef.alias.typeName.name === referenceName) {
                        const referenceSchema = recursiveVisit(typeDef.alias.alias);
                        typeValidatorSchema.set(referenceName, referenceSchema);
                    }
                } else if (ITypeDefinition.isEnum(typeDef)) {
                    if(typeDef.enum.typeName.name === referenceName) {
                        const referenceSchema = generateEnumValidatorSchema(typeDef.enum);
                        typeValidatorSchema.set(referenceName, referenceSchema);
                    }
                } else if (ITypeDefinition.isObject(typeDef)) {
                    if(typeDef.object.typeName.name === referenceName) {
                        const objectSchema = Joi.object(Object.fromEntries(typeDef.object.fields.map((field) => {
                            const fieldSchema = recursiveVisit(field.type);
                            return [field.fieldName, fieldSchema];
                        })));
                        typeValidatorSchema.set(typeDef.object.typeName.name, objectSchema);
                    }
                } else if (ITypeDefinition.isUnion(typeDef)) {
                    if (typeDef.union.typeName.name === referenceName) {
                        const unionSchema: {[k: string]: Schema}= Object.fromEntries(typeDef.union.union.map((u) => {
                            const baseSchema = recursiveVisit(u.type);
                            const uSchema = Joi
                                .when('type', { is: u.fieldName, then: baseSchema, otherwise: Joi.forbidden() });
                            return [u.fieldName, uSchema];
                        }));
                        unionSchema.type = Joi.string().valid(...typeDef.union.union.map((u) => u.fieldName));
                        typeValidatorSchema.set(typeDef.union.typeName.name, Joi.object(unionSchema));
                    }
                }
            });
            
            return typeValidatorSchema.get(referenceName)!;
        };

        const recursiveVisit = (type: IType): Schema => {
            if(IType.isExternal(type)) {
                const fallbackSchema = recursiveVisit(type.external.fallback);
                return fallbackSchema;
            } else if (IType.isList(type)) {
                const listSchema = recursiveVisit(type.list.itemType);
                return Joi.array().items(listSchema);
            } else if (IType.isMap(type)) {
                const mapSchema = recursiveVisit(type.map.valueType);
                return Joi.object().pattern(/.*/, mapSchema);
            } else if (IType.isOptional(type)) {
                const optionalSchema = recursiveVisit(type.optional.itemType);
                return optionalSchema.optional();
            } else if (IType.isPrimitive(type)) {
                if (typeValidatorSchema.get(type.primitive)) {
                    return typeValidatorSchema.get(type.primitive)!;
                }
            } else if (IType.isReference(type)) {
                if (typeValidatorSchema.has(type.reference.name)) {
                    return typeValidatorSchema.get(type.reference.name)!;
                }
                return getReferenceValidatorSchema(type.reference.name);
            } else if (IType.isSet(type)) {
                const setSchema = recursiveVisit(type.set.itemType);
                // this is also Array
                return Joi.array().items(setSchema);
            }

            // if unable to identify type, throw error
            throw new Error("Unknown IType");
        };

        typeDefs.forEach((typeDef) => { 
            if (ITypeDefinition.isAlias(typeDef)) {
                if (typeValidatorSchema.has(typeDef.alias.typeName.name)) {
                    return;
                }
                const aliasSchema = recursiveVisit(typeDef.alias.alias);
                typeValidatorSchema.set(typeDef.alias.typeName.name, aliasSchema);
            } else if (ITypeDefinition.isEnum(typeDef)) {
                if (typeValidatorSchema.has(typeDef.enum.typeName.name)) {
                    return;
                }
                typeValidatorSchema.set(typeDef.enum.typeName.name, generateEnumValidatorSchema(typeDef.enum));
            } else if (ITypeDefinition.isObject(typeDef)) {
                if (typeValidatorSchema.has(typeDef.object.typeName.name)) {
                    return;
                }
                const objectSchema = Joi.object(Object.fromEntries(typeDef.object.fields.map((field) => {
                    const fieldSchema = recursiveVisit(field.type);
                    return [field.fieldName, fieldSchema];
                })));
                typeValidatorSchema.set(typeDef.object.typeName.name, objectSchema);
            } else if (ITypeDefinition.isUnion(typeDef)) {
                if (typeValidatorSchema.has(typeDef.union.typeName.name)) {
                    return;
                }
                const unionSchema: { [k: string]: Schema } = Object.fromEntries(typeDef.union.union.map((u) => {
                    const baseSchema = recursiveVisit(u.type);
                    const uSchema = Joi
                        .when('type', { 'is': u.fieldName, then: baseSchema.required(), otherwise: Joi.forbidden() });
                    return [u.fieldName, uSchema];
                }));
                unionSchema.type = Joi.string().valid(...typeDef.union.union.map((u) => u.fieldName));
                return Joi.object(unionSchema);
            } else {
                throw new Error("Unknown ITypeDefinition");
            }
        });

        return typeValidatorSchema;
    }

    addService(typeDefs: Array<ITypeDefinition>, service: IServiceDefinition, implementation: any ): void {
        if (
            service === null ||
            typeof service !== 'object' ||
            implementation === null ||
            typeof implementation !== 'object'
        ) {
            throw new Error('addService() requires two objects as arguments');
        }

        const typeValidatorSchema = this._addValidator(typeDefs);

        // essentially for each endpoint
        // we need to do something like
        // fastify.get({path}, (request, reply) => {
        //     const args = extractArgs(request);
        //     try { return implFn(...args); } catch (err) { return {some error } }
        // })

        const recursiveSearchType = (searchType: IType): Schema => {
            if(IType.isExternal(searchType)) {
                const fallbackSchema = recursiveSearchType(searchType.external.fallback);
                return fallbackSchema;
            } else if (IType.isList(searchType)) {
                const listSchema = recursiveSearchType(searchType.list.itemType);
                return Joi.array().items(listSchema);
            } else if (IType.isMap(searchType)) {
                const mapSchema = recursiveSearchType(searchType.map.valueType);
                return Joi.object().pattern(/.*/, mapSchema);
            } else if (IType.isOptional(searchType)) {
                const optionalSchema = recursiveSearchType(searchType.optional.itemType);
                return optionalSchema.optional();
            } else if (IType.isPrimitive(searchType)) {
                if (typeValidatorSchema.get(searchType.primitive)) {
                    return typeValidatorSchema.get(searchType.primitive)!;
                }
            } else if (IType.isReference(searchType)) {
                if (typeValidatorSchema.has(searchType.reference.name)) {
                    return typeValidatorSchema.get(searchType.reference.name)!;
                }
            } else if (IType.isSet(searchType)) {
                const setSchema = recursiveSearchType(searchType.set.itemType);
                // this is also Array
                return Joi.array().items(setSchema);
            }

            throw new Error("Invalid IType");
        };

        const getArgsValidator = (args: IArgumentDefinition): Schema => {
            if (IType.isExternal(args.type)) {
                return recursiveSearchType(args.type.external.fallback);
            } else if (IType.isList(args.type)) {
                return Joi.array().items(recursiveSearchType(args.type.list.itemType));
            } else if (IType.isMap(args.type)) {
                return Joi.object().pattern(/.*/, recursiveSearchType(args.type.map.valueType));
            } else if(IType.isOptional(args.type)) {
                return recursiveSearchType(args.type.optional.itemType).optional();
            } else if (IType.isPrimitive(args.type)) {
                return recursiveSearchType(args.type);
            } else if (IType.isReference(args.type)) {
                return recursiveSearchType(args.type);
            } else if (IType.isSet(args.type)) {
                return Joi.array().items(recursiveSearchType(args.type.set.itemType));
            }
            throw new Error("Unknown IArgumentDefinition");
        };

        service.endpoints.forEach((endpointDefinition) => {
            // build path
            const routePath = buildRoute(endpointDefinition);

            // order args (we must maintain the same order as what we generate)
            // this is from conjure-typescript generator
            const sortedArgs = endpointDefinition.args
                .sort((a, b) => {
                    const aIsOptional = IType.isOptional(a.type);
                    const bIsOptional = IType.isOptional(b.type);
                    // maintain order except optional arguments are pushed to the back
                    return aIsOptional && !bIsOptional ? 1 : !aIsOptional && bIsOptional ? -1 : 0;
                });

            // here
            const deserialiseFns: ((request: FastifyRequest, reply: FastifyReply) => any)[] = 
                sortedArgs.map((arg) => {
                    if (IParameterType.isBody(arg.paramType)) {
                        return (request: FastifyRequest, reply: FastifyReply) => {
                            return request.body;
                        };
                    } else if (IParameterType.isPath(arg.paramType)) {
                        return (request: FastifyRequest, reply: FastifyReply) => {
                            return (<object>request.params)[arg.argName];
                        };
                    } else if (IParameterType.isQuery(arg.paramType)) {
                        return (request: FastifyRequest, reply: FastifyReply) => {
                            return (<object>request.query)[arg.argName];
                        };
                    } else if (IParameterType.isHeader(arg.paramType)) {
                        return (request: FastifyRequest, reply: FastifyReply) => {
                            // this is guaranteed to be string, and Conjure always expects string from header
                            return (<object>request.headers)[arg.argName];
                        };
                    } else {
                        throw new Error("Unknown type");
                    }
                });

            const schemaValidatorFns: ((args: any) => any)[] =
                sortedArgs.map((arg) => {
                    // default to required
                    const argsSchema = getArgsValidator(arg).options({ presence: 'required' });
                    return (args: any) => {
                        const { value, error } = argsSchema.validate(args);
                        if (error) {
                            throw new ConjureError(
                                ConjureErrorType.Parse,
                                "Validator error",
                                400,
                                { error: "Invalid Parameters" }
                            );
                        }

                        return value;
                    };
                });

            // implementation function
            let implFn = implementation[endpointDefinition.endpointName];
            if (!implFn) {;
                implFn = getDefaultHandler();
            }

            const respFn: ((request: FastifyRequest, reply: FastifyReply, resp: any) => void) =
                (function() {
                    if (!endpointDefinition.returns) {
                        return (request: FastifyRequest, reply: FastifyReply, resp: any) => {
                            reply.status(204);
                            return;
                        };
                    }
                    return (request: FastifyRequest, reply: FastifyReply, resp: any) => {
                        reply.status(200);
                        reply.type("application/json"); // Conjure is JSON first
                        return resp;
                    };
                }());

            const implWrappedFn = async (request: FastifyRequest, reply: FastifyReply) => {
                try {
                    const args = deserialiseFns.map((deserialiseFn, i) => schemaValidatorFns[i](deserialiseFn(request, reply)));
                    const resp = await implFn(...args);
                    return respFn(request, reply, resp);
                } catch (err) {
                    // assume no logging here
                    // err should be ConjureError
                    if (isConjureError(err)) {
                        // always force it to be application/json for now
                        // default to 500 if no status_code passed
                        reply.type("application/json").code(err.status || 500);
                        return err.body;
                    }
                    // else we just naively throw unhandled error here
                    reply.type("application/json").code(500);
                    return { error: "Unhandled error" };
                }
            };

            // PATCH is not in httpMethod (in conjure-api) definition
            switch (endpointDefinition.httpMethod) {
                case HttpMethod.GET:
                    this.fastify.get(routePath, implWrappedFn);
                    break;
                case HttpMethod.POST:
                    this.fastify.post(routePath, implWrappedFn);
                    break;
                case HttpMethod.PUT:
                    this.fastify.put(routePath, implWrappedFn);
                    break;
                case HttpMethod.DELETE:
                    this.fastify.delete(routePath, implWrappedFn);
                    break;
            }
        });

    }

    start(port = 8080): void {
        this.fastify.listen(port);
    }
}

export default ConjureServer;
