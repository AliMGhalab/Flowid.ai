import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Project, ProjectInput, FluidSystemRecommendation } from '@/types';

// Firestore does not accept undefined values — strip them before saving
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? null : v)));
}

// Stable hash of the input parameters that drive AI output.
// Excludes projectName (cosmetic) — same engineering inputs with different names
// still hit the same cache entry.
export async function computeInputHash(input: ProjectInput): Promise<string> {
  const canonical = {
    industry:                 (input.industry ?? '').trim().toLowerCase(),
    fluidType:                (input.fluidType ?? '').trim().toLowerCase(),
    customFluidType:          (input.customFluidType ?? '').trim().toLowerCase(),
    malaysiaState:            (input.malaysiaState ?? '').trim().toLowerCase(),
    siteEnvironment:          (input.siteEnvironment ?? '').trim().toLowerCase(),
    application:              (input.application ?? '').trim().toLowerCase().replace(/\s+/g, ' '),
    budget:                   input.budget ?? 0,
    specialRequirements:      (input.specialRequirements ?? '').trim().toLowerCase().replace(/\s+/g, ' '),
    scaleFlowRateValue:       input.scaleFlowRateValue ?? null,
    scaleFlowRateUnit:        input.scaleFlowRateUnit ?? null,
    scaleVolumeMonthlyValue:  input.scaleVolumeMonthlyValue ?? null,
    scaleVolumeMonthlyUnit:   input.scaleVolumeMonthlyUnit ?? null,
  };
  const json = JSON.stringify(canonical);
  // Web Crypto API — available in both browser and modern Node
  const buf = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Look for a recent project by this user with matching input hash.
// Returns the project ID if found, null otherwise.
export async function findCachedProject(
  userId: string,
  inputHash: string,
): Promise<{ id: string; project: Project } | null> {
  try {
    const q = query(
      collection(db, 'projects'),
      where('userId', '==', userId),
      where('inputHash', '==', inputHash),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    // Find newest matching project within max-age window
    const now = Date.now();
    let best: { id: string; project: Project } | null = null;
    for (const d of snapshot.docs) {
      const data = d.data();
      const createdAt = (data.createdAt as Timestamp)?.toDate() ?? new Date(0);
      const age = now - createdAt.getTime();
      if (age > CACHE_MAX_AGE_MS) continue;
      if (!best || createdAt > best.project.createdAt) {
        const project: Project = {
          id: d.id,
          ...data,
          createdAt,
          updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? createdAt,
        } as Project;
        best = { id: d.id, project };
      }
    }
    return best;
  } catch (err) {
    // Cache is an optimisation, never block generation if it fails
    console.warn('[firestore] findCachedProject failed, falling through to fresh generation:', err);
    return null;
  }
}

export async function createProject(
  userId: string,
  input: ProjectInput,
  recommendation: FluidSystemRecommendation,
  inputHash?: string,
): Promise<string> {
  const docRef = await addDoc(collection(db, 'projects'), {
    userId,
    projectName: input.projectName,
    status: 'complete',
    input: stripUndefined(input),
    recommendation: stripUndefined(recommendation),
    inputHash: inputHash ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getProject(projectId: string): Promise<Project | null> {
  const docRef = doc(db, 'projects', projectId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
  } as Project;
}

export async function getUserProjects(userId: string): Promise<Project[]> {
  const q = query(
    collection(db, 'projects'),
    where('userId', '==', userId)
  );
  const snapshot = await getDocs(q);
  const projects = snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
      updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
    } as Project;
  });
  // Sort by createdAt descending on the client (avoids composite index requirement)
  return projects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function deleteProject(projectId: string): Promise<void> {
  await deleteDoc(doc(db, 'projects', projectId));
}

export async function updateProjectName(projectId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'projects', projectId), {
    projectName: name,
    updatedAt: serverTimestamp(),
  });
}
