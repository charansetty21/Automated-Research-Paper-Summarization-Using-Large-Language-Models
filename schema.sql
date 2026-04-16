-- ============================================================
--  Automated Research Paper Summarization System
--  MySQL Database Schema + Sample Dataset
-- ============================================================

CREATE DATABASE IF NOT EXISTS research_summarizer
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE research_summarizer;

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(80)  NOT NULL UNIQUE,
    email       VARCHAR(120) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    role        ENUM('admin','researcher','viewer') DEFAULT 'researcher',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login  DATETIME
);

-- ─── Research Papers ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS papers (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(512) NOT NULL,
    authors         TEXT,
    abstract        TEXT,
    full_text       LONGTEXT,
    source_url      VARCHAR(1024),
    source_type     ENUM('pdf','arxiv','web','manual') DEFAULT 'manual',
    domain          VARCHAR(100),
    year            YEAR,
    uploaded_by     INT,
    uploaded_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    status          ENUM('pending','processing','summarized','failed') DEFAULT 'pending',
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Summaries ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS summaries (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    paper_id        INT NOT NULL,
    summary_type    ENUM('abstractive','extractive','hybrid','section') DEFAULT 'abstractive',
    summary_text    TEXT NOT NULL,
    key_findings    TEXT,
    methodology     TEXT,
    conclusion      TEXT,
    model_used      VARCHAR(100),
    rouge_score     FLOAT,
    bert_score      FLOAT,
    generated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    generated_by    INT,
    FOREIGN KEY (paper_id)     REFERENCES papers(id)  ON DELETE CASCADE,
    FOREIGN KEY (generated_by) REFERENCES users(id)   ON DELETE SET NULL
);

-- ─── Keywords ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS keywords (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    paper_id    INT NOT NULL,
    keyword     VARCHAR(200) NOT NULL,
    weight      FLOAT DEFAULT 1.0,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
);

-- ─── Feedback ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    summary_id      INT NOT NULL,
    user_id         INT,
    rating          TINYINT CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    submitted_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (summary_id) REFERENCES summaries(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES users(id)     ON DELETE SET NULL
);

-- ─── API Usage Log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_logs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT,
    endpoint    VARCHAR(200),
    method      VARCHAR(10),
    status_code SMALLINT,
    request_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
--  SAMPLE DATASET
-- ============================================================

-- Users
INSERT INTO users (username, email, password, role) VALUES
('admin',      'admin@researchai.io',   '$2b$12$hashplaceholder1',  'admin'),
('dr_sharma',  'sharma@iit.ac.in',      '$2b$12$hashplaceholder2',  'researcher'),
('prof_chen',  'chen@mit.edu',          '$2b$12$hashplaceholder3',  'researcher'),
('alice_r',    'alice@openai.com',      '$2b$12$hashplaceholder4',  'researcher'),
('bob_v',      'bob@deepmind.com',      '$2b$12$hashplaceholder5',  'viewer');

-- Papers
INSERT INTO papers (title, authors, abstract, source_url, source_type, domain, year, uploaded_by, status) VALUES
(
  'Attention Is All You Need',
  'Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Lukasz Kaiser, Illia Polosukhin',
  'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
  'https://arxiv.org/abs/1706.03762', 'arxiv', 'Natural Language Processing', 2017, 2, 'summarized'
),
(
  'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
  'Jacob Devlin, Ming-Wei Chang, Kenton Lee, Kristina Toutanova',
  'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.',
  'https://arxiv.org/abs/1810.04805', 'arxiv', 'Natural Language Processing', 2018, 2, 'summarized'
),
(
  'GPT-4 Technical Report',
  'OpenAI',
  'We report the development of GPT-4, a large multimodal model capable of processing image and text inputs and producing text outputs. GPT-4 exhibits human-level performance on various professional and academic benchmarks.',
  'https://arxiv.org/abs/2303.08774', 'arxiv', 'Large Language Models', 2023, 3, 'summarized'
),
(
  'LLaMA: Open and Efficient Foundation Language Models',
  'Hugo Touvron, Thibaut Lavril, Gautier Izacard, Xavier Martinet, et al.',
  'We introduce LLaMA, a collection of foundation language models ranging from 7B to 65B parameters. We train our models on trillions of tokens and show it is possible to train state-of-the-art models using publicly available datasets exclusively.',
  'https://arxiv.org/abs/2302.13971', 'arxiv', 'Large Language Models', 2023, 4, 'summarized'
),
(
  'Deep Residual Learning for Image Recognition',
  'Kaiming He, Xiangyu Zhang, Shaoqing Ren, Jian Sun',
  'We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously. We provide comprehensive empirical evidence showing that these residual networks are easier to optimize.',
  'https://arxiv.org/abs/1512.03385', 'arxiv', 'Computer Vision', 2015, 3, 'summarized'
),
(
  'Generative Adversarial Networks',
  'Ian Goodfellow, Jean Pouget-Abadie, Mehdi Mirza, Bing Xu, et al.',
  'We propose a new framework for estimating generative models via an adversarial process, in which we simultaneously train two models: a generative model G that captures the data distribution, and a discriminative model D that estimates the probability that a sample came from the training data rather than G.',
  'https://arxiv.org/abs/1406.2661', 'arxiv', 'Generative Models', 2014, 4, 'summarized'
),
(
  'A Survey of Large Language Models',
  'Wayne Xin Zhao, et al.',
  'Language models have received extensive research attention since the pre-training language models (PLMs) era. Recently, large language models (LLMs) have gained significant progress in language understanding and generation. This survey provides a comprehensive review of LLMs.',
  'https://arxiv.org/abs/2303.18223', 'arxiv', 'Survey', 2023, 2, 'summarized'
),
(
  'Chain-of-Thought Prompting Elicits Reasoning in Large Language Models',
  'Jason Wei, Xuezhi Wang, Dale Schuurmans, Maarten Bosma, et al.',
  'We explore how generating a chain of thought — a series of intermediate reasoning steps — significantly improves the ability of large language models to perform complex reasoning.',
  'https://arxiv.org/abs/2201.11903', 'arxiv', 'Prompt Engineering', 2022, 3, 'summarized'
);

-- Summaries
INSERT INTO summaries (paper_id, summary_type, summary_text, key_findings, methodology, conclusion, model_used, rouge_score, bert_score, generated_by) VALUES
(
  1, 'abstractive',
  'The Transformer architecture revolutionizes sequence modeling by replacing recurrent networks with a pure attention mechanism. The model uses multi-head self-attention to process all positions simultaneously, achieving superior parallelization and state-of-the-art performance on machine translation tasks.',
  'Self-attention allows O(1) path length between any positions. Multi-head attention enables attending to different representation subspaces. Achieves 28.4 BLEU on WMT 2014 English-to-German.',
  'Encoder-decoder architecture with stacked self-attention and feed-forward layers. Positional encoding to retain sequence order. Trained on WMT 2014 English-German and English-French datasets.',
  'The Transformer is the first transduction model based entirely on attention, replacing recurrent layers with multi-headed self-attention. It achieves state-of-the-art while being more parallelizable and requiring significantly less training time.',
  'GPT-4', 0.72, 0.89, 2
),
(
  2, 'abstractive',
  'BERT introduces bidirectional pre-training for language representations, allowing the model to condition on both left and right context simultaneously. Fine-tuning BERT on downstream tasks achieves state-of-the-art results across 11 NLP benchmarks.',
  'Bidirectional context significantly outperforms unidirectional models. Masked Language Modeling (MLM) enables deep bidirectionality. Achieves 80.5% on GLUE, 93.2% on SQuAD v1.1.',
  'Pre-training with Masked Language Model and Next Sentence Prediction. Fine-tuning on task-specific datasets with minimal architecture changes.',
  'BERT advances the state of the art for eleven NLP tasks and demonstrates the importance of bidirectional pre-training for language representations.',
  'GPT-4', 0.74, 0.91, 2
),
(
  3, 'abstractive',
  'GPT-4 is a large multimodal model that accepts image and text inputs and produces text outputs. It demonstrates human-level performance on numerous professional benchmarks including the Uniform Bar Exam and achieves top performance on standardized academic tests.',
  'Passes bar exam at ~90th percentile. Scores 163/170 on LSAT. Demonstrates emergent capabilities in reasoning and instruction following. Multimodal understanding of images and text.',
  'Large-scale transformer pre-training with RLHF alignment. Evaluated on standardized tests, academic benchmarks, and adversarial prompts.',
  'GPT-4 represents a significant capability jump from GPT-3.5, particularly in reasoning, coding, and following nuanced instructions.',
  'Claude', 0.71, 0.88, 3
),
(
  7, 'abstractive',
  'This comprehensive survey systematically reviews the development of Large Language Models (LLMs) covering four key aspects: pre-training, adaptation tuning, utilization, and capacity evaluation. It identifies key milestones from GPT-1 through ChatGPT and beyond.',
  'LLMs exhibit emergent abilities not present in smaller models. Instruction tuning dramatically improves zero-shot performance. RLHF is critical for aligning LLMs with human preferences.',
  'Systematic literature review covering architecture, training, evaluation, and deployment of LLMs. Covers over 500 papers in the field.',
  'LLMs have fundamentally changed the NLP landscape and are rapidly advancing toward artificial general intelligence capabilities.',
  'GPT-4', 0.69, 0.87, 2
),
(
  8, 'abstractive',
  'Chain-of-thought prompting improves LLM reasoning by prompting models to generate intermediate reasoning steps before producing a final answer. This technique is particularly effective for arithmetic, commonsense, and symbolic reasoning tasks.',
  'Chain-of-thought prompting achieves 95% on GSM8K with PaLM 540B. Emerges as an ability only in sufficiently large models (>100B parameters). Outperforms standard prompting by large margins on multi-step problems.',
  'Few-shot prompting with reasoning chains as demonstrations. Evaluated on arithmetic (GSM8K, SVAMP), commonsense (StrategyQA), and symbolic reasoning benchmarks.',
  'Chain-of-thought is a simple yet powerful technique that unlocks complex reasoning capabilities in large language models.',
  'Claude', 0.73, 0.90, 3
);

-- Keywords
INSERT INTO keywords (paper_id, keyword, weight) VALUES
(1, 'Transformer', 1.0), (1, 'Self-Attention', 0.95), (1, 'Multi-Head Attention', 0.9),
(1, 'Neural Machine Translation', 0.85), (1, 'Encoder-Decoder', 0.8),
(2, 'BERT', 1.0), (2, 'Bidirectional', 0.95), (2, 'Pre-training', 0.9),
(2, 'Masked Language Model', 0.88), (2, 'Fine-tuning', 0.82),
(3, 'GPT-4', 1.0), (3, 'Multimodal', 0.9), (3, 'RLHF', 0.88), (3, 'Alignment', 0.85),
(4, 'LLaMA', 1.0), (4, 'Open Source', 0.9), (4, 'Foundation Model', 0.88),
(5, 'ResNet', 1.0), (5, 'Residual Learning', 0.95), (5, 'Deep Networks', 0.88),
(6, 'GAN', 1.0), (6, 'Generative Model', 0.95), (6, 'Adversarial Training', 0.9),
(7, 'Large Language Models', 1.0), (7, 'Survey', 0.95), (7, 'ChatGPT', 0.88),
(8, 'Chain-of-Thought', 1.0), (8, 'Reasoning', 0.95), (8, 'Prompting', 0.9);

-- Feedback
INSERT INTO feedback (summary_id, user_id, rating, comment) VALUES
(1, 3, 5, 'Excellent summary, captures the key innovation of the Transformer perfectly.'),
(1, 5, 4, 'Good but could mention positional encoding more prominently.'),
(2, 4, 5, 'Very accurate and concise summary of BERT.'),
(3, 2, 4, 'Solid summary of GPT-4 capabilities.'),
(5, 3, 5, 'Captures the essence of chain-of-thought prompting well.');

-- ============================================================
--  VIEWS for analytics
-- ============================================================

CREATE OR REPLACE VIEW v_summary_stats AS
SELECT
    p.id           AS paper_id,
    p.title,
    p.domain,
    p.year,
    s.summary_type,
    s.model_used,
    s.rouge_score,
    s.bert_score,
    AVG(f.rating)  AS avg_rating,
    COUNT(f.id)    AS feedback_count
FROM papers p
LEFT JOIN summaries s ON p.id = s.paper_id
LEFT JOIN feedback  f ON s.id = f.summary_id
GROUP BY p.id, s.id;

CREATE OR REPLACE VIEW v_domain_counts AS
SELECT domain, COUNT(*) AS paper_count
FROM papers
GROUP BY domain;
