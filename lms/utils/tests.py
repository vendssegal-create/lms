import random
from datetime import timedelta
from django.utils import timezone
from lms.models import Question

def build_test_question_order(test):
    question_ids = list(Question.objects.filter(test=test).values_list('id', flat=True))
    if test.is_random_order:
        random.shuffle(question_ids)
    return question_ids[:test.question_count]

def get_questions_from_order(test, question_order):
    if not question_order:
        return []
    # Fetch questions and preserve order
    questions = Question.objects.filter(id__in=question_order)
    questions_by_id = {q.id: q for q in questions}
    return [questions_by_id[qid] for qid in question_order if qid in questions_by_id]

def normalize_score(value):
    normalized = round(float(value), 2)
    return int(normalized) if normalized.is_integer() else normalized

def calculate_test_score(test, total_questions, correct_count):
    if total_questions <= 0:
        return 0
    raw_score = (test.max_score * correct_count) / total_questions
    return normalize_score(raw_score)

def get_attempt_end_time(test, attempt):
    duration_end = None
    if test.duration_minutes:
        duration_end = attempt.started_at + timedelta(minutes=test.duration_minutes)
    
    if test.end_datetime:
        if duration_end:
            return min(duration_end, test.end_datetime)
        return test.end_datetime
    return duration_end
