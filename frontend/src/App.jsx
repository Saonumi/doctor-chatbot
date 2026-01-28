import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import PatientList from './components/PatientList';
import PatientForm from './components/PatientForm';
import PDFUpload from './components/PDFUpload';

function App() {
    return (
        <Router>
            <div className="flex h-screen bg-gray-50">
                <Sidebar />

                <main className="flex-1 overflow-y-auto p-6">
                    <Routes>
                        <Route path="/" element={<Navigate to="/add-patient" replace />} />
                        <Route path="/chat" element={<ChatInterface />} />
                        <Route path="/patients" element={<PatientList />} />
                        <Route path="/add-patient" element={<PatientForm />} />
                        <Route path="/upload" element={<PDFUpload />} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;
