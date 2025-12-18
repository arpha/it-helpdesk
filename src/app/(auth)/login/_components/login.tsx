"use client";

import FormInput from "@/components/common/form-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import {
  INITIAL_LOGIN_FORM,
  INITIAL_STATE_LOGIN_FORM,
} from "@/constants/auth-constant";
import { LoginForm, loginSchemaForm } from "@/validations/auth-validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { login } from "../actions";
import { Loader2 } from "lucide-react";

export default function Login() {
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchemaForm),
    defaultValues: INITIAL_LOGIN_FORM,
  });

  const [loginState, loginAction, isPendingLogin] = useActionState(
    login,
    INITIAL_STATE_LOGIN_FORM
  );

  const onSubmit = form.handleSubmit(async (data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value);
    });

    startTransition(() => {
      loginAction(formData);
    });
  });

  useEffect(() => {
    if (loginState?.status === "error" && loginState?.errors && "_form" in loginState.errors) {
      // Reset after showing error so user can try again
      const timer = setTimeout(() => {
        startTransition(() => {
          loginAction(null);
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [loginState, loginAction]);

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">IT HELPDESK RSUD CICALENGKA</CardTitle>
        <CardDescription>Login to access all features</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Show form-level errors */}
            {loginState?.errors && "_form" in loginState.errors && loginState.errors._form.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {loginState.errors._form.map((error: string, i: number) => (
                  <p key={i}>{error}</p>
                ))}
              </div>
            )}

            <FormInput
              form={form}
              name="email"
              label="Email"
              placeholder="Insert email here"
              type="email"
            />
            <FormInput
              form={form}
              name="password"
              label="Password"
              placeholder="******"
              type="password"
            />
            <Button type="submit" className="w-full" disabled={isPendingLogin}>
              {isPendingLogin ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
