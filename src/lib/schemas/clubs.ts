import { z } from "zod";

export const CreateClubSchema = z.object({
  name: z.string().min(1),
  tag: z.string().min(1),
  availability: z.enum(["Open", "Closed"]),
  founderID: z.string(),
});

export const UpdateClubSchema = z.object({
  uid: z.string(),
  newName: z.string().min(1),
  newTag: z.string().min(1),
  availability: z.enum(["Open", "Closed"]),
});

export const JoinClubSchema = z.object({
  uid: z.string(),
});

export type CreateClubInput = z.infer<typeof CreateClubSchema>;
export type UpdateClubInput = z.infer<typeof UpdateClubSchema>;