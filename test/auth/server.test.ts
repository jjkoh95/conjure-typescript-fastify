import { ConjureError, ConjureErrorType, DefaultHttpApiBridge } from "conjure-client";
import {
    ITypeDefinition,
    IServiceDefinition,
} from "conjure-api";
import ConjureServer from "../../src/server";
import config from "./test.conjure.json";
import fetch from "node-fetch";
import { 
    ITestAuthService,
    IUnauthenticated,
    TestAuthService,
    isUnauthenticated,
} from "./generated/fastify-test-auth";


// patch this to global
global.fetch = fetch as any;

const testAuthService: ITestAuthService = {
    async testAuth(authHeader?: string | null): Promise<void> {
        if (!authHeader) {
            const unauthResp: IUnauthenticated = {
                'errorCode': "PERMISSION_DENIED",
                'errorInstanceId': "", // pull from session
                'errorName': "User:Unauthenticated",
                'parameters': {
                },
            };

            throw new ConjureError(
                ConjureErrorType.Other,
                "Unauthenticated",
                403,
                unauthResp,
            );
        }
    }
};

const port = 8081;

const conjureClientService = new TestAuthService(new DefaultHttpApiBridge({
    userAgent: {
        productName: "TestAuth",
        productVersion: "0.0.1",
    },
    baseUrl: `http://localhost:${port}`,
}));

const server = new ConjureServer();

describe("Test Auth Conjure Server", () => {
    beforeAll(async () => {
        server.addService(
            config.types as ITypeDefinition[],
            config.services[0] as IServiceDefinition,
            testAuthService,
        );
        await server.start(port);
    });

    describe("Test Auth service", () => {
       it("Should return 204 with token", async () => {
           const bearerToken = "abc123";

           const resp = await conjureClientService.testAuth(bearerToken);

           expect(resp).toBeUndefined();
       });

       it("Should throw error without token", async () => {
           let err;
           try {
               const _resp = await conjureClientService.testAuth();
           } catch (conjureErr) {
               err = conjureErr;
           }

           expect(err).toBeDefined();
           expect(isUnauthenticated(err.body)).toBe(true);
       });
    });
    
    afterAll(async () => {
        await server.fastify.close();
    });
});
