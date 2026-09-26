type GradeChallengeStatus = "open" | "upheld" | "adjusted";

export function selectVisibleGradeChallenges<T extends { status: GradeChallengeStatus }>(
  challenges: readonly T[],
  showResolved: boolean
) {
  return challenges
    .filter((challenge) => showResolved || challenge.status === "open")
    .map((challenge, index) => ({ challenge, index }))
    .sort((left, right) => {
      const statusOrder = Number(left.challenge.status !== "open") - Number(right.challenge.status !== "open");
      return statusOrder || left.index - right.index;
    })
    .map(({ challenge }) => challenge);
}
