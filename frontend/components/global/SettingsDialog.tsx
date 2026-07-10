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
  const { isSettingsOpen, setSettingsOpen, profile, isLoading, isSaving, updateProfile, updatePreferences, updateSignature, updateVacation } = useSettingsStore();

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
            <TabsList className="grid w-full grid-cols-4 shrink-0">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="signature">Signature</TabsTrigger>
              <TabsTrigger value="vacation">Vacation</TabsTrigger>
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
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
