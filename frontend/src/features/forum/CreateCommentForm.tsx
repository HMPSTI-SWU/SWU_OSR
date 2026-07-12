'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

const commentSchema = z.object({
  body: z.string().min(1, 'Comment is required').max(10000),
});

type CommentFormValues = z.infer<typeof commentSchema>;

interface CreateCommentFormProps {
  repoId: string;
  threadId: string;
}

export function CreateCommentForm({ repoId, threadId }: CreateCommentFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
  });

  const createComment = useMutation({
    mutationFn: async (values: CommentFormValues) => {
      const { data } = await api.post(`/threads/${threadId}/comments`, values);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', threadId] });
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] });
      toast('Comment posted', 'success');
      reset();
    },
    onError: () => {
      toast('Failed to post comment', 'error');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add a Comment</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((data) => createComment.mutate(data))} className="space-y-4">
          <div className="space-y-2">
            <Textarea placeholder="Write your comment..." {...register('body')} />
            {errors.body && <p className="text-sm text-red-600">{errors.body.message}</p>}
          </div>
          <Button type="submit" disabled={createComment.isPending}>
            {createComment.isPending ? 'Posting...' : 'Post Comment'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
