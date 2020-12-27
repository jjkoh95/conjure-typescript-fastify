import { IHttpApiBridge } from "conjure-client";

/**
 * Constant reference to `undefined` that we expect to get minified and therefore reduce total code size
 */
const __undefined: undefined = undefined;

/**
 * Auth Service
 * 
 */
export interface ITestAuthService {
    testAuth(authHeader?: string | null): Promise<void>;
}

export class TestAuthService {
    constructor(private bridge: IHttpApiBridge) {
    }

    public testAuth(authHeader?: string | null): Promise<void> {
        return this.bridge.call<void>(
            "TestAuthService",
            "testAuth",
            "GET",
            "/auth/testAuth",
            __undefined,
            {
                "Authorization": authHeader,
            },
            __undefined,
            __undefined,
            __undefined,
            __undefined
        );
    }
}
