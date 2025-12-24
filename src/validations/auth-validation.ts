import z from "zod";

export const loginSchemaForm = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .regex(/^[a-z0-9._]+$/, "Username must be lowercase, no spaces"),
  password: z.string().min(1, "Password is required"),
});

export type LoginForm = z.infer<typeof loginSchemaForm>;
