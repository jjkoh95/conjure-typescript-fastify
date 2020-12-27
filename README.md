# Conjure Typescript Fastify

## Basic usage
```typescript
import ConjureServer from "conjure-typescript-fastify";
import config from "your-generated-ir-config.json";

const server = new ConjureServer();
server.addService(
    config.types as ITypeDefinition[],
    config.services[0] as IServiceDefinition,
    implementation, // this is where you implement the generated interface
);
server.start(8080).then(() => console.log("Server started"));
```
For better examples, please refer test
