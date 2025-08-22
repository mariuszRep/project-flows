import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseTaskDate(dateString: string | undefined | null): Date {
  if (!dateString) {
    return new Date(0); // Return epoch time for invalid/missing dates (oldest possible)
  }
  
  const parsedDate = new Date(dateString);
  // Check if the date is valid
  if (isNaN(parsedDate.getTime())) {
    return new Date(0); // Return epoch time for invalid dates (oldest possible)
  }
  
  return parsedDate;
}
