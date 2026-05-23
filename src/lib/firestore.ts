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

export async function createProject(
  userId: string,
  input: ProjectInput,
  recommendation: FluidSystemRecommendation
): Promise<string> {
  const docRef = await addDoc(collection(db, 'projects'), {
    userId,
    projectName: input.projectName,
    status: 'complete',
    input,
    recommendation,
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
