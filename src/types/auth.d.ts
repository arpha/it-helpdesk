export type AuthFormState = {
    status: string;
    errors: {
        email?: string[];
        password?: string[];
        _form?: string[];
    };
};
