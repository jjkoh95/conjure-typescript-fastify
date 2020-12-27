import { ICreateUserRequest } from "../fastify-test-types/createUserRequest";
import { IUpdateUserRequest } from "../fastify-test-types/updateUserRequest";
import { IUser } from "../fastify-test-types/user";
import { IHttpApiBridge } from "conjure-client";

/**
 * Constant reference to `undefined` that we expect to get minified and therefore reduce total code size
 */
const __undefined: undefined = undefined;

/**
 * CRUD Service
 * 
 */
export interface ITestCrudService {
    testGetAll(limit: number, offset: number): Promise<Array<IUser>>;
    testGetById(id: string): Promise<IUser>;
    testUpdateById(id: string, updateRequest: IUpdateUserRequest): Promise<IUser>;
    testCreate(createRequest: ICreateUserRequest): Promise<IUser>;
    testDeleteById(id: string): Promise<void>;
}

export class TestCrudService {
    constructor(private bridge: IHttpApiBridge) {
    }

    public testGetAll(limit: number, offset: number): Promise<Array<IUser>> {
        return this.bridge.call<Array<IUser>>(
            "TestCrudService",
            "testGetAll",
            "GET",
            "/crud/testGetAll",
            __undefined,
            __undefined,
            {
                "limit": limit,

                "offset": offset,
            },
            __undefined,
            __undefined,
            __undefined
        );
    }

    public testGetById(id: string): Promise<IUser> {
        return this.bridge.call<IUser>(
            "TestCrudService",
            "testGetById",
            "GET",
            "/crud/testGetById/{id}",
            __undefined,
            __undefined,
            __undefined,
            [
                id,
            ],
            __undefined,
            __undefined
        );
    }

    public testUpdateById(id: string, updateRequest: IUpdateUserRequest): Promise<IUser> {
        return this.bridge.call<IUser>(
            "TestCrudService",
            "testUpdateById",
            "PUT",
            "/crud/testUpdateById/{id}",
            updateRequest,
            __undefined,
            __undefined,
            [
                id,
            ],
            __undefined,
            __undefined
        );
    }

    public testCreate(createRequest: ICreateUserRequest): Promise<IUser> {
        return this.bridge.call<IUser>(
            "TestCrudService",
            "testCreate",
            "POST",
            "/crud/testCreate",
            createRequest,
            __undefined,
            __undefined,
            __undefined,
            __undefined,
            __undefined
        );
    }

    public testDeleteById(id: string): Promise<void> {
        return this.bridge.call<void>(
            "TestCrudService",
            "testDeleteById",
            "DELETE",
            "/crud/testDeleteById/{id}",
            __undefined,
            __undefined,
            __undefined,
            [
                id,
            ],
            __undefined,
            __undefined
        );
    }
}
