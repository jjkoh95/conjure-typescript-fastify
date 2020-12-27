import { ConjureError, ConjureErrorType, DefaultHttpApiBridge } from "conjure-client";
import {
    ITypeDefinition,
    IServiceDefinition,
} from "conjure-api";
import faker from "faker";
import ConjureServer from "../../src/server";
import { ITestCrudService, TestCrudService } from "./generated/fastify-test-crud";
import {
    IUser,
    IUpdateUserRequest,
    ICreateUserRequest,
    IUserNotFound,
    Gender,
    isUserNotFound,
} from "./generated/fastify-test-types";
import config from "./test.conjure.json";
import fetch from "node-fetch";

// patch this to global
global.fetch = fetch as any;

let users: IUser[] = [];

const testCRUDService: ITestCrudService = {
    async testGetAll(limit: number, offset: number): Promise<Array<IUser>> {
        if (offset > users.length) {
            return [];
        }
        return users.slice(offset, offset + limit);
    },
    async testGetById(id: string): Promise<IUser> {
        const user = users.find((u) => u.userId === id);
        if (!user) {
            const userNotFound: IUserNotFound = {
                errorCode: "NOT_FOUND",
                errorInstanceId: "", // get from session eg, session.get("id")
                errorName: "User:UserNotFound",
                parameters: {
                    userId: id,
                },
            };
            throw new ConjureError(ConjureErrorType.Other, "User not found", 404, userNotFound);
        }
        return user;
    },
    async testUpdateById(id: string, updateRequest: IUpdateUserRequest): Promise<IUser> {
        const user = users.find((u) => u.userId === id);
        if (!user) {
            const userNotFound: IUserNotFound = {
                errorCode: "NOT_FOUND",
                errorInstanceId: "", // get from session eg, session.get("id")
                errorName: "User:UserNotFound",
                parameters: {
                    userId: id,
                },
            };
            throw new ConjureError(ConjureErrorType.Other, "User not found", 404, userNotFound);
        }
        Object.assign(user, updateRequest);
        return user;
    },
    async testCreate(createRequest: ICreateUserRequest): Promise<IUser> {
        const user: IUser = {
            userId: faker.random.uuid(),
            ...createRequest,
        };
        users.push(user);
        return user;
    },
    async testDeleteById(id: string): Promise<void> {
        const userIndex = users.findIndex((u) => u.userId === id);
        if (userIndex < 0) {
            const userNotFound: IUserNotFound = {
                errorCode: "NOT_FOUND",
                errorInstanceId: "", // get from session eg, session.get("id")
                errorName: "User:UserNotFound",
                parameters: {
                    userId: id,
                },
            };
            throw new ConjureError(ConjureErrorType.Other, "User not found", 404, userNotFound);
        }
        users.splice(userIndex, 1);
    },
};

const port = 8080;

const conjureClientService = new TestCrudService(new DefaultHttpApiBridge({
    token: "",
    userAgent: {
        productName: "TestCRUD",
        productVersion: "0.0.1",
    },
    baseUrl: `http://localhost:${port}`,
}));

const server = new ConjureServer();

const createDummyUser = (): IUser => ({
    userId: faker.random.uuid(),
    email: faker.internet.email(),
    gender: faker.random.objectElement(Gender) as Gender,
    dateOfBirth: faker.date.past(10, '2010-01-01').toISOString(),
    numOfFollowers: faker.random.number({ min: 0, max: 10 }),
    balance: faker.random.float(100),
    isReferred: faker.random.boolean(),
    referralId: faker.random.uuid(),
    secretKeys: ["secret", "key"],
    remark: { something: "else" },
});

describe("Test CRUD Conjure Server", () => {
    beforeAll(async () => {
        // create server here
        server.addService(
            config.types as ITypeDefinition[],
            config.services[0] as IServiceDefinition,
            testCRUDService,
        );
        await server.start(port);
    });

    describe("Test Create endpoint", () => {
        it("Should create user successfully", async () => {
            const { userId, ...userData } = createDummyUser();
            const { userId: respUserId, ...respUserData } = await conjureClientService.testCreate(userData);
            expect(userData).toEqual(respUserData);
        });

        it("Should throw invalid parameter error", async () => {
            const user = createDummyUser();
            let err;
            try {
                const _resp = await conjureClientService.testCreate(user);
            } catch(conjureErr) {
                err = conjureErr;
            }
            expect(err).toBeDefined();
        });
    });

    describe("Test GetAll endpoint", () => {
        it("Should successfully return the correct user", async () => {
            users = [...new Array(10)].map(() => createDummyUser());
            const resp = await conjureClientService.testGetAll(3, 3);
            // expect to get index (3, 4, 5)
            expect(resp.length).toBe(3);
            expect(resp[0]).toEqual(users[3]);
            expect(resp[1]).toEqual(users[4]);
            expect(resp[2]).toEqual(users[5]);
        });

        it("Should return empty array if offset is larger than the array length", async () => {
            users = [...new Array(10)].map(() => createDummyUser());
            const resp = await conjureClientService.testGetAll(3, 10);
            expect(resp.length).toBe(0);
        });
    });

    describe("Test GetById endpoint", () => {
        it("Should successfully get user by id", async () => {
            users = [...new Array(10)].map(() => createDummyUser());
            const randomUser = faker.random.arrayElement(users);
            const resp = await conjureClientService.testGetById(randomUser.userId);

            expect(resp).toEqual(randomUser);
        });

        it("Should throw 404 not found error", async () => {
            users = [];
            const userId = faker.random.uuid();
            let err;
            try {
                const _resp = await conjureClientService.testGetById(userId);
            } catch (conjureErr) {
                err = conjureErr;
            }
            expect(isUserNotFound(err.body)).toBe(true);
        });
    });

    describe("Test Update user by ID", () => {
        it("Should successfully update user", async () => {
            users = [...new Array(10)].map(() => createDummyUser());
            const user = faker.random.arrayElement(users);
            
            const email = faker.internet.email();
            const referralId = faker.random.uuid();

            const resp = await conjureClientService.testUpdateById(user.userId, { email, referralId });

            user.email = email;
            user.referralId = referralId;
            expect(user).toEqual(resp);
        });

        it("Should throw NotFound error if ID is invalid", async () => {
            users = [];
            const userId = faker.random.uuid();
            
            const email = faker.internet.email();
            const referralId = faker.random.uuid();

            let err;
            try {
                const _resp = await conjureClientService.testUpdateById(userId, { email, referralId });
            } catch (conjureErr) {
                err = conjureErr;
            }

            expect(isUserNotFound(err.body)).toBe(true);
        });
    });

    describe("Test Delete user by ID", () => {
        it("Should successfully remove user", async () => {
            users = [...new Array(10)].map(() => createDummyUser());
            const user = faker.random.arrayElement(users);

            const resp = await conjureClientService.testDeleteById(user.userId);

            expect(resp).toBeUndefined(); // 204 no content
        });

        it("Should throw error if user not found", async () => {
            users = [];
            const userId = faker.random.uuid();

            let err;
            try {
                const _resp = await conjureClientService.testDeleteById(userId);
            } catch (conjureErr) {
                err = conjureErr;
            }

            expect(isUserNotFound(err.body)).toBe(true);
        });
    });


    afterAll(async () => {
        await server.fastify.close();
    });
});