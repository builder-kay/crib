import type { CreatorVerificationStatus, ProfileVerificationField } from "@/lib/types";

export type ProfileVerificationInput = {
  avatar_url?: string | null;
  display_name?: string | null;
  creator_category?: string | null;
  niche?: string | null;
  bio?: string | null;
  website?: string | null;
  instagram?: string | null;
  x?: string | null;
};

export const PROFILE_VERIFICATION_REQUIREMENTS: Array<{
  id: ProfileVerificationField;
  label: string;
  description: string;
}> = [
  {
    id: "avatar",
    label: "Profile photo",
    description: "Add a clear face or brand avatar."
  },
  {
    id: "display_name",
    label: "Display name",
    description: "Use the public name buyers should recognize."
  },
  {
    id: "creator_category",
    label: "Category",
    description: "Choose the main creative lane you work in."
  },
  {
    id: "niche",
    label: "Niche",
    description: "Describe the specific style or specialty you focus on."
  },
  {
    id: "bio",
    label: "Bio",
    description: "Write a solid introduction to your work and strengths."
  },
  {
    id: "social_link",
    label: "Public link",
    description: "Add at least one website or social handle for trust."
  }
];

function hasValue(value: string | null | undefined, minimum = 1) {
  return (value?.trim().length ?? 0) >= minimum;
}

function hasSocialLink(input: ProfileVerificationInput) {
  return hasValue(input.website) || hasValue(input.instagram) || hasValue(input.x);
}

export function getProfileVerificationChecklist(input: ProfileVerificationInput) {
  return PROFILE_VERIFICATION_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    complete:
      requirement.id === "avatar"
        ? hasValue(input.avatar_url)
        : requirement.id === "display_name"
          ? hasValue(input.display_name, 2)
          : requirement.id === "creator_category"
            ? hasValue(input.creator_category, 2)
            : requirement.id === "niche"
              ? hasValue(input.niche, 2)
              : requirement.id === "bio"
                ? hasValue(input.bio, 20)
                : hasSocialLink(input)
  }));
}

export function getProfileVerificationMissingFields(input: ProfileVerificationInput): ProfileVerificationField[] {
  return getProfileVerificationChecklist(input)
    .filter((item) => !item.complete)
    .map((item) => item.id);
}

export function isProfileVerificationComplete(input: ProfileVerificationInput) {
  return getProfileVerificationMissingFields(input).length === 0;
}

export function describeProfileVerificationField(field: ProfileVerificationField) {
  return PROFILE_VERIFICATION_REQUIREMENTS.find((item) => item.id === field)?.label ?? field.replace(/_/g, " ");
}

export function getVerificationStatusLabel(status: CreatorVerificationStatus) {
  if (status === "approved") {
    return "Verified on Crib";
  }
  if (status === "pending") {
    return "Pending admin review";
  }
  if (status === "rejected") {
    return "Needs updates";
  }
  return "Complete your profile";
}
