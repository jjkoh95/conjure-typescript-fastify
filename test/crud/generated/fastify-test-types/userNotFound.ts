export interface IUserNotFound {
    'errorCode': "NOT_FOUND";
    'errorInstanceId': string;
    'errorName': "User:UserNotFound";
    'parameters': {
        userId: string;
    };
}

export function isUserNotFound(arg: any): arg is IUserNotFound {
    return arg && arg.errorName === "User:UserNotFound";
}
