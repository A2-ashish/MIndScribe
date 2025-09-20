import React from 'react';
import { JournalInput } from '../components/JournalInput';
import { MediaUploadButton } from '../components/MediaUploadButton';
import { MediaAssetsList } from '../components/MediaAssetsList';
import { CapsuleDisplay } from '../components/CapsuleDisplay';
import { AccountUpgrade } from '../components/AccountUpgrade';

type Props = {
  uid: string | null;
  entryId: string | null;
  setEntryId: (id: string | null) => void;
  submitting: boolean;
  handleSubmit: (text: string) => Promise<void> | void;
  handleCreateDraft: () => Promise<void> | void;
  capsule: any;
  loading: boolean;
};

export const AppPage: React.FC<Props> = ({ uid, entryId, setEntryId, submitting, handleSubmit, handleCreateDraft, capsule, loading }) => {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-1">MindScribe</h1>
      <p className="text-muted mb-4">
        {uid ? 'Welcome back.' : 'Welcome.'}
      </p>

      <div id="journal">
        <JournalInput onSubmit={handleSubmit} onCreateDraft={handleCreateDraft} hasDraft={!!entryId} disabled={submitting} />
      </div>

      <div id="media">
        {entryId && uid ? (
          <div className="panel">
            <div className="section-header" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Media for this entry</h3>
              <div className="toolbar">
                <MediaUploadButton entryId={entryId} />
              </div>
            </div>
            <MediaAssetsList entryId={entryId} />
          </div>
        ) : null}
      </div>

      <CapsuleDisplay capsule={capsule} loading={loading} />
      <AccountUpgrade />
    </div>
  );
};
