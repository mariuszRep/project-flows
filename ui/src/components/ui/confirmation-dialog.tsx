import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}) => {
  const dialogTitleId = React.useId();
  const dialogDescriptionId = React.useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      aria-describedby={dialogDescriptionId}
    >
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
        <div className="mb-4">
          <h2 id={dialogTitleId} className="text-lg font-semibold">
            {title}
          </h2>
          <p id={dialogDescriptionId} className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
