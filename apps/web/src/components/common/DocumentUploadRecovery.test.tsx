import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { DocumentUploadDropzone } from './DocumentUploadDropzone';
afterEach(() => vi.restoreAllMocks());
test.each(['network', 'server', 'attachment', 'validation'])(
  'upload recovery distinguishes %s failure',
  async (failure) => {
    const fetcher = vi.spyOn(globalThis, 'fetch');
    if (failure === 'network') fetcher.mockRejectedValue(new TypeError('Network unavailable'));
    else
      fetcher.mockResolvedValue(
        new Response(
          JSON.stringify(
            failure === 'attachment'
              ? {
                  document: {
                    id: 'file',
                    displayFileName: 'proof.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: 5,
                  },
                }
              : { message: 'Upload rejected' },
          ),
          { status: failure === 'attachment' ? 200 : failure === 'server' ? 503 : 415 },
        ),
      );
    const check = vi.fn();
    const uploaded = vi.fn(async () => {
      if (failure === 'attachment') throw new Error('Could not attach');
    });
    render(
      <DocumentUploadDropzone
        documentType={{
          key: 'PROOF',
          name: 'Proof',
          allowedMimeTypes: ['application/pdf'],
          allowedExtensions: ['.pdf'],
          maximumSizeBytes: 1000,
        }}
        onUploaded={uploaded}
        onCheckExisting={check}
      />,
    );
    fireEvent.change(screen.getByLabelText('Choose file to upload'), {
      target: { files: [new File(['proof'], 'proof.pdf', { type: 'application/pdf' })] },
    });
    if (failure === 'validation') {
      expect(await screen.findByText('Upload rejected')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Check existing documents' }),
      ).not.toBeInTheDocument();
    } else {
      fireEvent.click(await screen.findByRole('button', { name: 'Check existing documents' }));
      expect(check).toHaveBeenCalledOnce();
      expect(
        screen.getByText(
          failure === 'attachment'
            ? /Your file uploaded, but/
            : /Your file may already be in Documents/,
        ),
      ).toBeInTheDocument();
    }
    await waitFor(() => expect(screen.getByRole('button', { name: 'Select file' })).toBeEnabled());
    expect(fetcher).toHaveBeenCalledOnce();
  },
);
