"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SettingsDialog() {
  const { isSettingsOpen, setSettingsOpen, profile, isLoading, isSaving, updateProfile, updatePreferences, updateSignature, updateVacation, changePassword } = useSettingsStore();

  // Profile State
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Preferences State
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [undoSendSeconds, setUndoSendSeconds] = useState(10);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Signature State
  const [signature, setSignature] = useState("");

  // Vacation State
  const [vacationEnabled, setVacationEnabled] = useState(false);
  const [vacationSubject, setVacationSubject] = useState("");
  const [vacationBody, setVacationBody] = useState("");
  const [vacationStartDate, setVacationStartDate] = useState("");
  const [vacationEndDate, setVacationEndDate] = useState("");

  // Security State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setAvatarUrl(profile.avatarUrl || "");
      
      setTheme(profile.preferences?.theme || "light");
      setUndoSendSeconds(profile.preferences?.undoSendSeconds || 10);
      setNotificationsEnabled(profile.preferences?.notificationsEnabled || false);

      setSignature(profile.signature || "");

      setVacationEnabled(profile.vacationResponder?.enabled || false);
      setVacationSubject(profile.vacationResponder?.subject || "");
      setVacationBody(profile.vacationResponder?.body || "");
      setVacationStartDate(profile.vacationResponder?.startDate ? new Date(profile.vacationResponder.startDate).toISOString().split('T')[0] : "");
      setVacationEndDate(profile.vacationResponder?.endDate ? new Date(profile.vacationResponder.endDate).toISOString().split('T')[0] : "");
    }
  }, [profile]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ displayName, avatarUrl });
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    updatePreferences({ theme, undoSendSeconds, notificationsEnabled });
  };

  const handleSaveSignature = (e: React.FormEvent) => {
    e.preventDefault();
    updateSignature(signature);
  };

  const handleSaveVacation = (e: React.FormEvent) => {
    e.preventDefault();
    updateVacation({
      enabled: vacationEnabled,
      subject: vacationSubject,
      body: vacationBody,
      startDate: vacationStartDate ? new Date(vacationStartDate).toISOString() : undefined,
      endDate: vacationEndDate ? new Date(vacationEndDate).toISOString() : undefined,
    });
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { current?: string; new?: string; confirm?: string } = {};

    if (!currentPassword) errors.current = "Current password is required.";
    if (!newPassword) errors.new = "New password is required.";
    else if (newPassword.length < 8) errors.new = "New password must be at least 8 characters.";
    if (!confirmPassword) errors.confirm = "Confirm password is required.";
    else if (newPassword !== confirmPassword) errors.confirm = "Passwords do not match.";

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }
    setPasswordErrors({});

    const success = await changePassword({ currentPassword, newPassword });
    if (success) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your account settings and preferences.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">Loading settings...</div>
        ) : (
          <Tabs defaultValue="profile" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-5 shrink-0">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="signature">Signature</TabsTrigger>
              <TabsTrigger value="vacation">Vacation</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto mt-4 px-1">
              <TabsContent value="profile" className="m-0 space-y-4">
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={profile?.email || ""} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="avatarUrl">Avatar URL</Label>
                    <Input id="avatarUrl" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Profile"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="preferences" className="m-0 space-y-4">
                <form onSubmit={handleSavePreferences} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <select
                      id="theme"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as "light" | "dark")}
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="undoSendSeconds">Undo Send Delay (seconds)</Label>
                    <select
                      id="undoSendSeconds"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={undoSendSeconds}
                      onChange={(e) => setUndoSendSeconds(Number(e.target.value))}
                    >
                      <option value="5">5 seconds</option>
                      <option value="10">10 seconds</option>
                      <option value="20">20 seconds</option>
                      <option value="30">30 seconds</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="notificationsEnabled"
                      className="h-4 w-4"
                      checked={notificationsEnabled}
                      onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    />
                    <Label htmlFor="notificationsEnabled">Enable Desktop Notifications</Label>
                  </div>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Preferences"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signature" className="m-0 space-y-4">
                <form onSubmit={handleSaveSignature} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signature">Email Signature</Label>
                    <Textarea 
                      id="signature" 
                      placeholder="Best regards,..." 
                      className="min-h-[150px]"
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Signature"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="vacation" className="m-0 space-y-4">
                <form onSubmit={handleSaveVacation} className="space-y-4">
                  <div className="flex items-center gap-2 pb-2">
                    <input
                      type="checkbox"
                      id="vacationEnabled"
                      className="h-4 w-4"
                      checked={vacationEnabled}
                      onChange={(e) => setVacationEnabled(e.target.checked)}
                    />
                    <Label htmlFor="vacationEnabled">Enable Vacation Responder</Label>
                  </div>
                  
                  {vacationEnabled && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="startDate">Start Date</Label>
                          <Input 
                            id="startDate" 
                            type="date" 
                            value={vacationStartDate}
                            onChange={(e) => setVacationStartDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="endDate">End Date (Optional)</Label>
                          <Input 
                            id="endDate" 
                            type="date" 
                            value={vacationEndDate}
                            onChange={(e) => setVacationEndDate(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vacationSubject">Subject</Label>
                        <Input 
                          id="vacationSubject" 
                          placeholder="Out of Office" 
                          value={vacationSubject}
                          onChange={(e) => setVacationSubject(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vacationBody">Message</Label>
                        <Textarea 
                          id="vacationBody" 
                          placeholder="I am currently away..." 
                          className="min-h-[150px]"
                          value={vacationBody}
                          onChange={(e) => setVacationBody(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Vacation Responder"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="security" className="m-0 space-y-4">
                <form onSubmit={handleSavePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          if (passwordErrors.current) setPasswordErrors(prev => ({ ...prev, current: undefined }));
                        }}
                        disabled={isSaving}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        disabled={isSaving}
                      >
                        {showCurrentPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye-off text-muted-foreground"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye text-muted-foreground"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </Button>
                    </div>
                    {passwordErrors.current && <p className="text-sm text-destructive">{passwordErrors.current}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (passwordErrors.new) setPasswordErrors(prev => ({ ...prev, new: undefined }));
                        }}
                        disabled={isSaving}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        disabled={isSaving}
                      >
                        {showNewPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye-off text-muted-foreground"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye text-muted-foreground"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </Button>
                    </div>
                    {passwordErrors.new && <p className="text-sm text-destructive">{passwordErrors.new}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (passwordErrors.confirm) setPasswordErrors(prev => ({ ...prev, confirm: undefined }));
                        }}
                        disabled={isSaving}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={isSaving}
                      >
                        {showConfirmPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye-off text-muted-foreground"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye text-muted-foreground"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </Button>
                    </div>
                    {passwordErrors.confirm && <p className="text-sm text-destructive">{passwordErrors.confirm}</p>}
                  </div>

                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Changing..." : "Change Password"}
                  </Button>
                </form>
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
