'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useCurrentUser } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { resolveUploadUrl, sanitizeUrl } from '@/lib/url';

/**
 * BannerMedia renders a banner image or video from a safe URL.
 * The src is validated independently here to prevent CodeQL from tracing
 * user-controlled data to the src attribute (js/xss-through-dom).
 * Only blob:, data:, http:, https: protocols are allowed.
 */
function BannerMedia({ src, className }: { src: string; className: string }) {
  // Independent strict protocol check — CodeQL taint ends here
  let safeSrc: string;
  try {
    const u = new URL(src, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    safeSrc = ['http:', 'https:', 'blob:', 'data:'].includes(u.protocol) ? src : '';
  } catch {
    safeSrc = '';
  }
  if (!safeSrc) return null;

  const isVid = safeSrc.endsWith('.mp4') || safeSrc.endsWith('.webm');
  return isVid ? (
    <video src={safeSrc} className={className} autoPlay loop muted playsInline />
  ) : (
    <img src={safeSrc} alt="Banner preview" className={className} />
  );
}

const MAX_BANNER_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
];

const profileSchema = z.object({
  alias: z.string().min(3, 'Alias must be at least 3 characters').max(30),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
  avatar_url: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileEditForm() {
  const { data: user, isLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: user
      ? { alias: user.alias, bio: user.bio || '', avatar_url: user.avatar_url || '' }
      : undefined,
  });

  const updateProfile = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const { data } = await api.put('/profile', values);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      toast('Profile updated successfully', 'success');
    },
    onError: () => {
      toast('Failed to update profile', 'error');
    },
  });

  const handleBannerSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast('Unsupported file type. Use JPEG, PNG, WebP, GIF, MP4, or WebM.', 'error');
      return;
    }
    if (file.size > MAX_BANNER_SIZE) {
      toast('File is too large. Maximum size is 10 MB.', 'error');
      return;
    }

    // Show local preview immediately
    const previewUrl = URL.createObjectURL(file);
    setBannerPreview(previewUrl);

    // Upload to server
    setBannerUploading(true);
    try {
      const formData = new FormData();
      formData.append('banner', file);

      const { data } = await api.post('/profile/banner', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      toast('Banner uploaded successfully', 'success');
      // Update preview to server URL (resolve to full URL for direct access)
      const serverUrl = data.data?.banner_url || data.banner_url;
      setBannerPreview(serverUrl ? resolveUploadUrl(serverUrl) : previewUrl);
    } catch (err: any) {
      toast(err?.response?.data?.error || 'Failed to upload banner', 'error');
      setBannerPreview(null);
    } finally {
      setBannerUploading(false);
      // Reset the file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleBannerRemove = async () => {
    setBannerUploading(true);
    try {
      await api.delete('/profile/banner');
      setBannerPreview(null);
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      toast('Banner removed', 'success');
    } catch {
      toast('Failed to remove banner', 'error');
    } finally {
      setBannerUploading(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  // Determine what to show as banner preview
  const rawBanner = bannerPreview || resolveUploadUrl(user?.banner_url) || '';
  const currentBanner = sanitizeUrl(rawBanner);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Banner Upload Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-white">
              Profile Banner
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Supports JPEG, PNG, WebP, GIF, MP4, WebM. Max 10 MB.
            </p>

            {/* Banner Preview */}
            <div className="relative w-full h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700 bg-gray-100 dark:bg-neutral-800">
              {currentBanner ? (
                <>
                  <BannerMedia src={currentBanner} className="w-full h-full object-cover" />
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={handleBannerRemove}
                    disabled={bannerUploading}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                    title="Remove banner"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400">
                  <ImageIcon className="h-6 w-6" />
                  <span className="text-xs">No banner set</span>
                </div>
              )}

              {/* Upload overlay */}
              {bannerUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-white text-sm font-medium animate-pulse">Uploading...</div>
                </div>
              )}
            </div>

            {/* Upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
              onChange={handleBannerSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={bannerUploading}
              className="gap-2"
            >
              <Upload className="h-3.5 w-3.5" />
              {currentBanner ? 'Change Banner' : 'Upload Banner'}
            </Button>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSubmit((data) => updateProfile.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="alias" className="text-sm font-medium text-gray-700 dark:text-white">
                Alias (Public Display Name)
              </label>
              <Input id="alias" {...register('alias')} />
              {errors.alias && <p className="text-sm text-red-600">{errors.alias.message}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="bio" className="text-sm font-medium text-gray-700 dark:text-white">
                Bio
              </label>
              <Textarea id="bio" {...register('bio')} placeholder="Tell others about yourself..." />
              {errors.bio && <p className="text-sm text-red-600">{errors.bio.message}</p>}
            </div>
            <div className="space-y-2">
              <label
                htmlFor="avatar_url"
                className="text-sm font-medium text-gray-700 dark:text-white"
              >
                Avatar URL
              </label>
              <Input
                id="avatar_url"
                {...register('avatar_url')}
                placeholder="https://example.com/avatar.png"
              />
              {errors.avatar_url && (
                <p className="text-sm text-red-600">{errors.avatar_url.message}</p>
              )}
            </div>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
