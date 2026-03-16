import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import CandidateListUploader from "./CandidateListUploader";

export default async function SetupCandidatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  await requireAuth();
  const { projectId } = await params;
  const { next } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  if (!project) return notFound();

  const nextUrl = next ?? `/projects/${projectId}/setup/manual`;

  return (
    <CandidateListUploader
      projectId={projectId}
      projectName={project.name}
      nextUrl={nextUrl}
    />
  );
}
