export interface IUnauthenticated {
    'errorCode': "PERMISSION_DENIED";
    'errorInstanceId': string;
    'errorName': "User:Unauthenticated";
    'parameters': {
    };
}

export function isUnauthenticated(arg: any): arg is IUnauthenticated {
    return arg && arg.errorName === "User:Unauthenticated";
}
