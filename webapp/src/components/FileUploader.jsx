import React, { useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import './FileUploader.css';

export default function FileUploader({ onFileLoaded, onError }) {

    const handleUpload = useCallback((file) => {
        if (!file) return;

        // Check extension
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'xlsx' && ext !== 'xls') {
            onError("Please upload a valid Excel file (.xlsx or .xls)");
            return;
        }

        // Read as ArrayBuffer for SheetJS
        const reader = new FileReader();
        reader.onload = (e) => {
            onFileLoaded(e.target.result);
        };
        reader.onerror = () => {
            onError("Error reading file.");
        };
        reader.readAsArrayBuffer(file);

    }, [onFileLoaded, onError]);

    const onDrop = useCallback((e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleUpload(e.dataTransfer.files[0]);
        }
    }, [handleUpload]);

    const onDragOver = useCallback((e) => {
        e.preventDefault();
    }, []);

    const onFileChange = useCallback((e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleUpload(e.target.files[0]);
        }
    }, [handleUpload]);

    return (
        <div
            className="file-uploader"
            onDrop={onDrop}
            onDragOver={onDragOver}
        >
            <input
                type="file"
                id="fileInput"
                accept=".xlsx, .xls"
                onChange={onFileChange}
                style={{ display: 'none' }}
            />
            <label htmlFor="fileInput" className="uploader-content">
                <UploadCloud size={48} className="upload-icon" />
                <h3>לחץ כאן או משוך קובץ אקסל</h3>
                <p>ניתן להעלות קובץ נתונים מעודכן (.xlsx)</p>
            </label>
        </div>
    );
}
