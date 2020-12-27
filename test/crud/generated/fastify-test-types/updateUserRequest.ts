import { Gender } from "./gender";

export interface IUpdateUserRequest {
    'email'?: string | null;
    'gender'?: Gender | null;
    'dateOfBirth'?: string | null;
    'numOfFollowers'?: number | null;
    'balance'?: number | "NaN" | null;
    'isReferred'?: boolean | null;
    'referralId'?: string | null;
    'secretKeys'?: Array<string> | null;
    'remark'?: any | null;
}
