'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { Plus, Minus } from 'lucide-react';

const threadSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(255),
  body: z.string().min(1, 'Body is required').max(10000),
});

type ThreadFormValues = z.infer<typeof threadSchema>;

interface CreateThreadFormProps {
  repoId: string;
}

export function CreateThreadForm({ repoId }: CreateThreadFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ThreadFormValues>({
    resolver: zodResolver(threadSchema),
  });

  const createThread = useMutation({
    mutationFn: async (values: ThreadFormValues) => {
      const { data } = await api.post(`/repos/${repoId}/threads`, values);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads', repoId] });
      toast('Thread created successfully', 'success');
      reset();
      setIsOpen(false);
    },
    onError: () => {
      toast('Failed to create thread', 'error');
    },
  });

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <CardTitle className="text-base flex items-center gap-2">
          {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          New Discussion
        </CardTitle>
      </CardHeader>
      {isOpen && (
        <CardContent>
          <form onSubmit={handleSubmit((data) => createThread.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Input placeholder="Discussion title" {...register('title')} />
              {errors.title && <p className="text-sm text-red-600">{errors.title.message}</p>}
            </div>
            <div className="space-y-2">
              <Textarea placeholder="Write your message..." {...register('body')} />
              {errors.body && <p className="text-sm text-red-600">{errors.body.message}</p>}
            </div>
            <Button type="submit" disabled={createThread.isPending}>
              {createThread.isPending ? 'Posting...' : 'Post Discussion'}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
