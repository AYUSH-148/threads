"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Check } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ChangeEvent, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Spinner } from "./ui/spinner";
import { useToast } from "./ui/use-toast";
import { updateUser } from "@/lib/actions/user.action";
import { useUploadThing } from "@/lib/uploadthing";
import { isBase64Image } from "@/lib/utils";
import { UserValidation } from "@/lib/validators/user";

export interface ProfileFormUser {
  id: string;
  objectId: string;
  username: string;
  name: string;
  bio: string;
  image: string;
}

interface ProfileFormProps {
  user: ProfileFormUser;
  submitLabel?: string;
}

/**
 * The onboarding form and the edit-profile form were two near-identical files
 * that had already drifted apart — one read `fileUrl` off the upload response
 * and the other `url`. Sharing one component means they cannot drift again, and
 * the styling only has to be right once.
 */
const ProfileForm = ({ user, submitLabel = "Continue" }: ProfileFormProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { startUpload } = useUploadThing("media");
  const { toast } = useToast();

  const [files, setFiles] = useState<File[]>([]);

  const form = useForm<z.infer<typeof UserValidation>>({
    resolver: zodResolver(UserValidation),
    defaultValues: {
      profile_photo: user?.image ?? "",
      name: user?.name ?? "",
      username: user?.username ?? "",
      bio: user?.bio ?? "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;
  const bio = form.watch("bio") ?? "";

  const onSubmit = async (values: z.infer<typeof UserValidation>) => {
    try {
      if (isBase64Image(values.profile_photo)) {
        const uploaded = await startUpload(files);
        // The two copies of this form disagreed on the field name. Taking
        // either keeps working across uploadthing's response shapes.
        const url = uploaded?.[0]?.url ?? (uploaded?.[0] as any)?.fileUrl;
        if (url) values.profile_photo = url;
      }

      await updateUser({
        name: values.name,
        path: pathname,
        username: values.username,
        bio: values.bio,
        image: values.profile_photo,
      });

      if (pathname === "/profile/edit") {
        router.back();
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        variant: "destructive",
        title: "Profile not saved",
        description: "Something went wrong. Your changes are still here.",
      });
    }
  };

  const handleImage = (
    event: ChangeEvent<HTMLInputElement>,
    fieldChange: (value: string) => void
  ) => {
    event.preventDefault();

    const file = event.target.files?.[0];
    if (!file || !file.type.includes("image")) return;

    setFiles([file]);

    const reader = new FileReader();
    reader.onload = (loaded) => fieldChange(loaded.target?.result?.toString() ?? "");
    reader.readAsDataURL(file);
  };

  const photo = form.watch("profile_photo");

  return (
    <form
      className="flex flex-col gap-7"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      {/* Avatar picker. The whole circle is the label, so clicking the image
          opens the file dialog — the old layout put a bare file input beside
          it with the default browser chrome. */}
      <div className="flex items-center gap-5">
        <label
          htmlFor="profile-photo"
          className="group relative h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-full border border-hairline bg-surface-2"
        >
          {photo ? (
            <Image
              src={photo}
              alt="Profile photo"
              width={96}
              height={96}
              priority
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-fg-subtle">
              <Camera className="h-7 w-7" strokeWidth={1.8} />
            </span>
          )}

          <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity duration-250 group-hover:opacity-100">
            <Camera className="h-6 w-6" strokeWidth={2} />
          </span>
        </label>

        <div>
          <p className="text-small-semibold text-fg">Profile photo</p>
          <p className="mt-0.5 text-small-regular text-fg-subtle">
            PNG or JPG. Click the circle to replace it.
          </p>
        </div>

        <input
          id="profile-photo"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) =>
            handleImage(event, (value) => form.setValue("profile_photo", value))
          }
        />
      </div>

      <Field
        label="Name"
        error={form.formState.errors.name?.message}
        input={
          <input
            type="text"
            className="field-input"
            placeholder="Your display name"
            disabled={isSubmitting}
            {...form.register("name")}
          />
        }
      />

      <Field
        label="Username"
        error={form.formState.errors.username?.message}
        input={
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base-regular text-fg-subtle">
              @
            </span>
            <input
              type="text"
              className="field-input pl-8"
              placeholder="username"
              disabled={isSubmitting}
              {...form.register("username")}
            />
          </div>
        }
      />

      <Field
        label="Bio"
        hint={`${bio.length} characters`}
        error={form.formState.errors.bio?.message}
        input={
          <textarea
            rows={6}
            className="field-input resize-y leading-relaxed"
            placeholder="A line or two about you"
            disabled={isSubmitting}
            {...form.register("bio")}
          />
        }
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-brand w-full py-3 sm:w-auto sm:self-end sm:px-8"
      >
        {isSubmitting ? (
          <Spinner className="h-4 w-4" label="Saving" />
        ) : (
          <Check className="h-4 w-4" strokeWidth={2.4} />
        )}
        {isSubmitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
};

function Field({
  label,
  hint,
  error,
  input,
}: {
  label: string;
  hint?: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-small-semibold text-fg">{label}</span>
        {hint && <span className="text-subtle-medium text-fg-subtle">{hint}</span>}
      </div>
      {input}
      {error && <p className="text-subtle-medium text-danger">{error}</p>}
    </div>
  );
}

export default ProfileForm;
