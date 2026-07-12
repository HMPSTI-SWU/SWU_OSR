export type AcademicTag =
  'coursework' | 'thesis' | 'hackathon' | 'personal_research' | 'team_project';

export interface ShowcaseRepo {
  id: string;
  user_id: string;
  github_repo_id: number;
  repo_name: string;
  repo_full_name: string;
  description: string;
  language: string;
  html_url: string;
  academic_tag: AcademicTag;
  created_at: string;
  updated_at: string;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  language: string;
  html_url: string;
  private: boolean;
}

export interface ShowcaseSelection {
  repo_id: number;
  repo_name: string;
  full_name: string;
  tag: AcademicTag;
}
