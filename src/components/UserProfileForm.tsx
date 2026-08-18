"use client";

import ProfileForm, { type ProfileFormUser } from "./ProfileForm";

/** Onboarding's entry point into the shared profile form. */
const UserProfileForm = ({ userData }: { userData: ProfileFormUser }) => (
  <ProfileForm user={userData} submitLabel="Continue" />
);

export default UserProfileForm;
