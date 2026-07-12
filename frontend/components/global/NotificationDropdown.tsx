"use client";

import * as React from "react";
import { Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEmailStore } from "@/store/emailStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export function NotificationDropdown() {
  const { 
    notifications, 
    unreadCount, 
    fetchNotifications, 
    markNotificationRead, 
    markAllNotificationsRead, 
    deleteNotification 
  } = useEmailStore();
  
  const [open, setOpen] = React.useState(false);
  const [hasFetched, setHasFetched] = React.useState(false);

  React.useEffect(() => {
    if (open && !hasFetched) {
      fetchNotifications();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasFetched(true);
    }
  }, [open, hasFetched, fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const renderContent = () => (
    <div className="flex flex-col h-full max-h-[80vh] md:max-h-[500px]">
      <div className="flex items-center justify-between p-4 pb-2 shrink-0">
        <h4 className="font-semibold text-sm">Notifications</h4>
        {unreadCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-8 text-primary" 
            onClick={handleMarkAllRead}
          >
            Mark all as read
          </Button>
        )}
      </div>
      <Separator />
      
      <ScrollArea className="flex-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Bell className="h-10 w-10 mb-4 opacity-20" />
            <p className="text-sm font-medium">No notifications</p>
            <p className="text-xs mt-1">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {notifications.map((notification) => (
              <div 
                key={notification._id}
                className={`relative flex flex-col gap-1 p-3 rounded-md transition-colors ${
                  notification.isRead ? "opacity-70 hover:bg-muted/50" : "bg-muted/50 hover:bg-muted"
                }`}
                onClick={() => {
                  if (!notification.isRead) {
                    markNotificationRead(notification._id).catch(() => {
                      toast.error("Failed to mark read");
                    });
                  }
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <p className={`text-sm ${!notification.isRead ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <span className="flex h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  )}
                </div>
                <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
                   <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification._id).then(() => {
                        toast.success("Notification deleted");
                      }).catch(() => {
                        toast.error("Failed to delete notification");
                      });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  return (
    <>
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="text-muted-foreground relative inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9" title="Notifications">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground border-2 border-background">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] p-0 sm:max-w-none">
            <SheetHeader className="sr-only">
              <SheetTitle>Notifications</SheetTitle>
            </SheetHeader>
            {renderContent()}
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden md:block">
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger className="text-muted-foreground relative inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9" title="Notifications">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground border-2 border-background">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            {renderContent()}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
