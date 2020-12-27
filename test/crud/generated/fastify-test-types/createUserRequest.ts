import { Gender } from "./gender";

export interface ICreateUserRequest {
    'email': string;
    'gender': Gender;
    'dateOfBirth': string;
    'numOfFollowers': number;
    'balance': number | "NaN";
    'isReferred': boolean;
    'referralId'?: string | null;
    'secretKeys': Array<string>;
    'remark': any;
}
