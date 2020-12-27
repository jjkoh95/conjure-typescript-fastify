import { Gender } from "./gender";

export interface IUser {
    'userId': string;
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
