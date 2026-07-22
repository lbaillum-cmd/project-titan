CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "User" ("id" TEXT NOT NULL, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, "firstName" TEXT, "lastName" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "User_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Session" ("id" TEXT NOT NULL, "refreshTokenHash" TEXT NOT NULL, "userId" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Session_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Profile" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "bio" TEXT, "avatarUrl" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Profile_pkey" PRIMARY KEY ("id"));
CREATE TABLE "State" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "code" TEXT NOT NULL, CONSTRAINT "State_pkey" PRIMARY KEY ("id"));
CREATE TABLE "City" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "stateId" TEXT NOT NULL, CONSTRAINT "City_pkey" PRIMARY KEY ("id"));
CREATE TABLE "CommunityRole" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, CONSTRAINT "CommunityRole_pkey" PRIMARY KEY ("id"));
CREATE TABLE "CommunityMembership" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "stateId" TEXT NOT NULL, "cityId" TEXT NOT NULL, "roleId" TEXT NOT NULL, "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CommunityMembership_pkey" PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
CREATE UNIQUE INDEX "State_name_key" ON "State"("name");
CREATE UNIQUE INDEX "State_code_key" ON "State"("code");
CREATE UNIQUE INDEX "City_stateId_name_key" ON "City"("stateId", "name");
CREATE UNIQUE INDEX "CommunityRole_name_key" ON "CommunityRole"("name");
CREATE UNIQUE INDEX "CommunityMembership_userId_key" ON "CommunityMembership"("userId");
CREATE INDEX "CommunityMembership_cityId_idx" ON "CommunityMembership"("cityId");
CREATE INDEX "CommunityMembership_stateId_idx" ON "CommunityMembership"("stateId");
CREATE INDEX "CommunityMembership_roleId_idx" ON "CommunityMembership"("roleId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "City" ADD CONSTRAINT "City_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CommunityRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
