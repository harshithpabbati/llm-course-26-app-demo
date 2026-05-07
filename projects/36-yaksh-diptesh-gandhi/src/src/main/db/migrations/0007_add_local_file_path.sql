-- 添加 local_file_path 字段到 documents 表
-- 用于存储拷贝到应用数据目录的文件路径
ALTER TABLE documents ADD COLUMN local_file_path TEXT;
