"use client";

export default function DashboardError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <section className="dashboard-error" role="alert">
      <h2>Dashboard data is unavailable</h2>
      <p>
        The dashboard could not load data from the university database. Check
        the database connection, then try again.
      </p>
      <button className="submit-button" onClick={retry} type="button">
        Retry
      </button>
    </section>
  );
}
