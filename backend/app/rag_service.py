import os
from dotenv import load_dotenv

from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_text_splitters.character import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_classic.chains import create_retrieval_chain
from langchain_core.output_parsers import StrOutputParser

# Load biến môi trường
load_dotenv()

# Cấu hình đường dẫn tuyệt đối để tránh lỗi path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VECTOR_DB_PATH = os.path.join(BASE_DIR, "storage", "vector_db")
INDEX_NAME = "tcm_index"

class RAGService:
    def __init__(self):
        # 1. Khởi tạo model Embeddings Local (Miễn phí, không giới hạn)
        # Sử dụng model hỗ trợ đa ngôn ngữ (bao gồm tiếng Việt)
        print("📥 Đang tải/load model embedding local (lần đầu sẽ hơi lâu)...")
        # Sử dụng model paraphrase-multilingual-MiniLM-L12-v2 hỗ trợ tiếng Việt tốt
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
        )
        self.vector_db = None
        
        # 2. Khởi tạo LLM với Gemini 2.5 Flash
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.3,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        
        # 3. Load bộ nhớ cũ nếu đã từng học
        self._load_db()

    def _load_db(self):
        """Hàm load Vector DB từ ổ cứng lên RAM"""
        if os.path.exists(os.path.join(VECTOR_DB_PATH, INDEX_NAME)):
            try:
                self.vector_db = FAISS.load_local(
                    os.path.join(VECTOR_DB_PATH, INDEX_NAME), 
                    self.embeddings,
                    allow_dangerous_deserialization=True
                )
                print("✅ Đã load dữ liệu tri thức cũ")
            except Exception as e:
                print(f"❌ Lỗi load DB: {e}")
        else:
            print("📚 Chưa có dữ liệu tri thức - Đang tự động load PDF...")
            self._auto_load_pdfs()
    
    def _auto_load_pdfs(self):
        """Tự động load tất cả PDF có sẵn vào vector database"""
        pdf_dir = os.path.join(BASE_DIR, "storage", "pdfs")
        if not os.path.exists(pdf_dir):
            print("❌ Không tìm thấy thư mục storage/pdfs")
            return
        
        pdf_files = [f for f in os.listdir(pdf_dir) if f.endswith('.pdf')]
        if not pdf_files:
            print("📁 Không có file PDF nào trong storage/pdfs")
            return
        
        print(f"🔍 Tìm thấy {len(pdf_files)} file PDF, đang tự động nạp...")
        total_chunks = 0
        for pdf_file in pdf_files:
            pdf_path = os.path.join(pdf_dir, pdf_file)
            try:
                chunks = self.ingest_pdf(pdf_path)
                total_chunks += chunks
                print(f"  ✅ {pdf_file}: {chunks} chunks")
            except Exception as e:
                print(f"  ❌ {pdf_file}: Lỗi - {str(e)}")
        
        print(f"🎉 Đã auto-load {total_chunks} chunks từ {len(pdf_files)} PDFs!")

    def ingest_pdf(self, file_path: str):
        """
        Hàm đọc file PDF và nạp vào bộ nhớ
        Sử dụng PyPDFLoader đơn giản và ổn định
        """
        print(f"📖 Đang xử lý file: {file_path}")
        
        try:
            # Dùng PyPDFLoader - đơn giản, ổn định
            loader = PyPDFLoader(file_path)
            docs = loader.load()
            
            if not docs or len(docs) == 0:
                print("❌ Không thể đọc nội dung PDF")
                return 0
            
            print(f"📄 Đã đọc {len(docs)} trang từ PDF")
            
            # DEBUG: Check if docs have actual text content
            total_text_length = sum(len(doc.page_content.strip()) for doc in docs)
            print(f"🔍 DEBUG: Tổng độ dài text: {total_text_length} ký tự")
            
            if total_text_length < 10:
                print("⚠️ PDF có thể là scan/image, không có text layer. Cần OCR!")
                return 0
            
            # Cắt nhỏ văn bản (Chunking)
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000, 
                chunk_overlap=200
            )
            chunks = splitter.split_documents(docs)
            
            print(f"🔍 DEBUG: Số chunks sau split: {len(chunks) if chunks else 0}")
            
            if not chunks or len(chunks) == 0:
                print("❌ Không có nội dung sau chunking")
                return 0

            # Lưu vào Vector DB (FAISS)
            if self.vector_db:
                self.vector_db.add_documents(chunks)
            else:
                self.vector_db = FAISS.from_documents(chunks, self.embeddings)
                
            # Lưu xuống ổ cứng
            if not os.path.exists(VECTOR_DB_PATH):
                os.makedirs(VECTOR_DB_PATH)
                
            self.vector_db.save_local(os.path.join(VECTOR_DB_PATH, INDEX_NAME))
            print(f"✅ Đã học xong {len(chunks)} đoạn kiến thức")
            return len(chunks)
            
        except Exception as e:
            print(f"❌ Lỗi khi xử lý PDF: {e}")
            return 0

    def ask(self, symptoms: str, use_vision: bool = False):
        """
        Hàm chẩn đoán bệnh
        
        Args:
            symptoms: Triệu chứng của bệnh nhân
            use_vision: Có sử dụng vision model không (cho ảnh)
        """
        if not self.vector_db:
            return "Xin lỗi, tôi chưa được học tài liệu nào cả. Vui lòng upload sách PDF trước."

        # 2. Tạo Prompt (Nhân cách bác sĩ Đông Y)
        prompt = ChatPromptTemplate.from_template("""
            Bạn là một Bác sĩ Đông Y (Lương y) thâm niên, uy tín và tận tâm.
            Nhiệm vụ của bạn là hỗ trợ chẩn đoán dựa trên tài liệu y văn được cung cấp dưới đây.

            <Tài liệu tham khảo>
            {context}
            </Tài liệu tham khảo>
            
            Bệnh nhân mô tả triệu chứng: "{input}"
            
            Hãy đưa ra câu trả lời chi tiết theo cấu trúc sau:
            1. **Chẩn đoán sơ bộ**: Tên bệnh danh, Bát cương (Hàn/Nhiệt, Hư/Thực...).
            2. **Biện chứng luận trị**: Giải thích nguyên nhân tại sao bệnh nhân bị như vậy dựa trên tạng phủ.
            3. **Pháp trị & Phương dược**: Đề xuất bài thuốc (nêu rõ các vị thuốc nếu có trong tài liệu).
            4. **Lời khuyên**: Chế độ ăn uống, sinh hoạt.

            Nếu tài liệu không có thông tin về triệu chứng này, hãy nói trung thực: "Xin lỗi, trong các sách tôi đã học chưa có thông tin về triệu chứng này."
        """)

        # 3. Tạo chuỗi xử lý (Chain)
        # Retriever tìm 5 đoạn văn bản giống nhất trong sách
        retriever = self.vector_db.as_retriever(search_kwargs={"k": 5})
        
        # Kết hợp LLM + Prompt + Retriever
        chain = create_retrieval_chain(
            retriever, 
            create_stuff_documents_chain(self.llm, prompt)
        )
        
        # 4. Chạy và trả về kết quả
        res = chain.invoke({"input": symptoms})
        return res["answer"]
    
    def chat(self, user_input: str):
        """
        Hàm chat với người dùng, tham khảo kiến thức từ Vector DB
        Trả về câu trả lời + tài liệu tham khảo
        """
        if not self.vector_db:
            return {
                "answer": "Xin lỗi, tôi chưa được học tài liệu nào. Vui lòng upload PDF trước.",
                "sources": []
            }
        
        # 1. Tìm kiếm tài liệu liên quan
        retriever = self.vector_db.as_retriever(search_kwargs={"k": 5})
        relevant_docs = retriever.invoke(user_input)  # Updated method
        context = "\n\n".join([doc.page_content for doc in relevant_docs])
        
        # 2. Tạo prompt
        prompt = ChatPromptTemplate.from_template("""
            Bạn là Bác sĩ Đông Y chuyên nghiệp với kiến thức sâu rộng.
            
            <Tài liệu tham khảo>
            {context}
            </Tài liệu tham khảo>
            
            Câu hỏi: "{input}"
            
            Hãy trả lời dựa trên tài liệu tham khảo ở trên. Nếu tài liệu có thông tin liên quan, hãy:
            1. Liệt kê các bệnh có thể gặp
            2. Đề xuất phác đồ điều trị, bài thuốc (nếu có)
            3. Đưa ra lời khuyên về chế độ ăn uống, sinh hoạt
            
            Nếu tài liệu HOÀN TOÀN không liên quan đến câu hỏi, hãy nói: "Xin lỗi, tôi chưa có thông tin về vấn đề này trong tài liệu."
        """)
        
        # 3. Chain
        chain = (
            {"context": lambda x: context, "input": lambda x: x}
            | prompt
            | self.llm
            | StrOutputParser()
        )
        
        answer = chain.invoke(user_input)
        
        # 4. Extract sources from metadata
        sources = []
        for doc in relevant_docs:
            if hasattr(doc, 'metadata') and 'source' in doc.metadata:
                source_path = doc.metadata['source']
                # Get filename from path
                filename = os.path.basename(source_path)
                if filename not in sources:
                    sources.append(filename)
        
        return {
            "answer": answer,
            "sources": sources
        }