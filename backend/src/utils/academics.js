const GRADE_POINTS = {
  A: 4,
  'B+': 3.5,
  B: 3,
  'C+': 2.5,
  C: 2,
  D: 1,
  F: 0,
};

function calculateAcademicSummary(results) {
  const semesters = new Map();
  let totalQualityPoints = 0;
  let totalCredits = 0;

  for (const result of results) {
    const credits = Number(result.courseId?.credits || 0);
    const gradePoint = GRADE_POINTS[result.grade] ?? 0;
    const qualityPoints = gradePoint * credits;
    const semester = result.semester || 'Unassigned semester';
    const level = result.level || '';
    const academicYear = result.academicYear || '';
    const key = `${academicYear}|${level}|${semester}`;
    const current = semesters.get(key) || { semester, level, academicYear, credits: 0, qualityPoints: 0, results: [] };

    current.credits += credits;
    current.qualityPoints += qualityPoints;
    current.results.push(result);
    semesters.set(key, current);
    totalCredits += credits;
    totalQualityPoints += qualityPoints;
  }

  const semesterSummaries = Array.from(semesters.values()).map((summary) => ({
    ...summary,
    gpa: summary.credits ? Number((summary.qualityPoints / summary.credits).toFixed(2)) : 0,
  }));

  return {
    semesters: semesterSummaries,
    totalCredits,
    cgpa: totalCredits ? Number((totalQualityPoints / totalCredits).toFixed(2)) : 0,
  };
}

module.exports = { GRADE_POINTS, calculateAcademicSummary };
