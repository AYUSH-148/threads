"use client";

import ProfileForm, { type ProfileFormUser } from "./ProfileForm";

/**
 * Thin wrapper kept so /profile/edit's import path does not change. The form
 * itself is shared with onboarding — see ProfileForm.
 */
const AccountProfile = ({ user }: { user: ProfileFormUser }) => (
  <ProfileForm user={user} submitLabel="Save changes" />
);

export default AccountProfile;
