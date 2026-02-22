export type ClubAvailability = 'Open' | 'Invite' | 'Closed';

export type ClubRole = 'Member' | 'Founder';

export type Club = {
    name: string;
    tag: string;
    availability: ClubAvailability;
    memberCount: number;
};

export type UserClub = Club & {
    memberRole: ClubRole;
};