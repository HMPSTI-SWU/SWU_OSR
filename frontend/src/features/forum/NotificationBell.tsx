'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Notification } from '@/types/forum';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Bell } from 'lucide-react';

export function NotificationBell() {
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: Notification[] }>('/notifications');
      return data.data;
    },
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

  return (
    <DropdownMenu
      trigger={
        <button className="relative p-2 rounded-md hover:bg-gray-100 dark:bg-neutral-800 transition-colors">
          <Bell className="h-5 w-5 text-gray-600 dark:text-white" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      }
    >
      <div className="max-h-64 overflow-auto">
        {!notifications || notifications.length === 0 ? (
          <div className="px-3 py-4 text-sm text-gray-500 dark:text-white text-center">
            No notifications
          </div>
        ) : (
          notifications.slice(0, 10).map((notif) => (
            <DropdownMenuItem
              key={notif.id}
              onClick={() => {
                if (!notif.is_read) markRead.mutate(notif.id);
              }}
              className={notif.is_read ? 'opacity-60' : 'font-medium'}
            >
              <p className="text-sm">{notif.message}</p>
              <p className="text-xs text-gray-400 dark:text-white mt-0.5">
                {new Date(notif.created_at).toLocaleDateString()}
              </p>
            </DropdownMenuItem>
          ))
        )}
      </div>
    </DropdownMenu>
  );
}
