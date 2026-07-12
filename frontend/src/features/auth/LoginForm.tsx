'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSIAKADLogin } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, LogIn } from 'lucide-react';

const loginSchema = z.object({
  nim: z.string().min(1, 'NIM is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const login = useSIAKADLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormValues) => {
    login.mutate(data);
  };

  return (
    <Card className="w-full max-w-md geist-level-4">
      <CardHeader className="text-center pb-2">
        <div className="lg:hidden flex justify-center mb-4">
          <div className="h-12 w-12 rounded-geist-md bg-geist-primary dark:bg-white flex items-center justify-center">
            <LogIn className="h-5 w-5 text-geist-on-primary dark:text-black" />
          </div>
        </div>
        <CardTitle className="text-display-md">Sign in.</CardTitle>
        <CardDescription className="mt-2">
          Use your SIAKAD credentials to authenticate, then link your GitHub account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="nim" className="text-body-sm-strong text-geist-ink dark:text-white">
              NIM (Student ID)
            </label>
            <Input id="nim" placeholder="Enter your NIM" {...register('nim')} className="h-12" />
            {errors.nim && (
              <p className="text-caption text-geist-error dark:text-white flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.nim.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-body-sm-strong text-geist-ink dark:text-white"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              {...register('password')}
              className="h-12"
            />
            {errors.password && (
              <p className="text-caption text-geist-error dark:text-white flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.password.message}
              </p>
            )}
          </div>
          {login.isError && (
            <div className="p-3 rounded-geist-sm bg-geist-error-soft dark:bg-neutral-800">
              <p className="text-body-sm text-geist-error-deep dark:text-white flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Authentication failed. Please check your credentials.
              </p>
            </div>
          )}
          <Button type="submit" className="w-full h-12" disabled={login.isPending}>
            {login.isPending ? 'Authenticating...' : 'Continue with SIAKAD'}
          </Button>
          <p className="text-caption text-center text-geist-mute dark:text-white pt-2">
            By signing in, you agree to use this platform responsibly.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
