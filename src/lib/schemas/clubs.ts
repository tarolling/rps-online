import { z } from "zod";

const uid = z.string().min(1, "User ID is required.");
const clubName = z.string().trim().min(1, "Club name is required.").max(40, "Club name must be 40 characters or fewer.");
const clubTag = z.string().trim().min(1, "Club tag is required.").max(6, "Club tag must be 6 characters or fewer.");
const clubAvailability = z.enum(["Open", "Invite", "Closed"]);

export const CreateClubSchema = z.object({
  uid,
  name: clubName,
  tag: clubTag,
  availability: clubAvailability,
});

export const UpdateClubSchema = z.object({
  uid,
  newName: clubName,
  newTag: clubTag,
  availability: clubAvailability,
});

export const JoinClubSchema = z.object({
  uid,
});

export type CreateClubInput = z.infer<typeof CreateClubSchema>;
export type UpdateClubInput = z.infer<typeof UpdateClubSchema>;
export type JoinClubInput = z.infer<typeof JoinClubSchema>;
