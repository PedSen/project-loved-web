import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import type { Response as SuperAgentResponse, ResponseError } from 'superagent';
import superagent from 'superagent';
import type {
  AssigneeType,
  GameMode,
  IBeatmapset,
  ICaptain,
  ILog,
  INomination,
  INominationWithPollResult,
  IPollResult,
  IRound,
  ISubmission,
  IUser,
  IUserWithoutRoles,
  IMapperConsent,
  MetadataState,
  ModeratorState,
  PartialWithId,
  PartialWithoutId,
  IReview,
  ISettings,
} from './interfaces';

interface SuperAgentResponseWithBody<BodyType> extends SuperAgentResponse {
  body: BodyType;
}
type Response<BodyType = undefined> = Promise<SuperAgentResponseWithBody<BodyType>>;

interface ApiObjectTypes {
  beatmapset: IBeatmapset;
  user: IUser;
}
type ApiObjectType = keyof ApiObjectTypes;

export function isApiObjectType(type: any): type is ApiObjectType {
  return ['beatmapset', 'user'].includes(type);
}

export function addNomination(
  beatmapsetId: number,
  gameMode: GameMode,
  parentId: number | null,
  roundId: number,
): Response<INomination> {
  return superagent.post('/api/nomination-submit').send({
    beatmapsetId,
    gameMode,
    parentId,
    roundId,
  });
}

export function addOrUpdateReview(
  beatmapsetId: number,
  gameMode: GameMode,
  reason: string,
  score: number,
): Response<IReview> {
  return superagent.post('/api/review').send({ beatmapsetId, gameMode, reason, score });
}

export function addRound(): Response<{ id: number }> {
  return superagent.post('/api/add-round');
}

export function addSubmission(
  beatmapsetId: number,
  gameModes: GameMode[],
  reason: string | null,
): Response {
  return superagent.post('/api/submit').send({ beatmapsetId, gameModes, reason });
}

export function addUser(name: string): Response<IUser> {
  return superagent.post('/api/add-user').send({ name });
}

export function authRemember(): Response<IUser> {
  return superagent.get('/api/auth/remember');
}

export function deleteNomination(nominationId: number): Response {
  return superagent.delete('/api/nomination').query({ nominationId });
}

export function deleteReview(reviewId: number): Response {
  return superagent.delete('/api/review').query({ reviewId });
}

export function getAssignees(): Response<{ metadatas: IUser[]; moderators: IUser[] }> {
  return superagent.get('/api/assignees');
}

export function getCaptains(): Response<{ [P in GameMode]?: ICaptain[] }> {
  return superagent.get('/api/captains');
}

export function getNominations(
  roundId: number,
): Response<{ nominations: INominationWithPollResult[]; round: IRound }> {
  return superagent.get('/api/nominations').query({ roundId });
}

export function getPollResults(): Response<IPollResult[]> {
  return superagent.get('/api/stats/polls');
}

interface GetRoundsResponseBody {
  complete_rounds: (IRound & { nomination_count: number })[];
  incomplete_rounds: (IRound & { nomination_count: number })[];
}

export function getRounds(): Response<GetRoundsResponseBody> {
  return superagent.get('/api/rounds');
}

export function getSettings(): Response<ISettings> {
  return superagent.get('/api/settings');
}

export function getLogs(): Response<ILog[]> {
  return superagent.get('/api/logs');
}

export interface GetSubmissionsResponseBody {
  beatmapsets: (IBeatmapset & {
    beatmap_counts: Record<GameMode, number>;
    consent: boolean | null;
    modal_bpm: number;
    nominated_round_name: string | null;
    poll?: {
      passed: boolean;
      topic_id: number;
    };
    poll_in_progress: boolean;
    review_score: number;
    reviews: IReview[];
    score: number;
    strictly_rejected: boolean;
    submissions: ISubmission[];
  })[];
  usersById: Record<
    number,
    IUserWithoutRoles & {
      alumni: boolean | null;
    }
  >;
}

export function getSubmissions(gameMode: GameMode): Response<GetSubmissionsResponseBody> {
  return superagent.get('/api/submissions').query({ gameMode });
}

export interface GetTeamResponseBody {
  alumni: {
    [P in GameMode | 'dev' | 'metadata' | 'moderator' | 'news' | 'other']?: IUserWithoutRoles[];
  };
  current: {
    [P in GameMode | 'dev' | 'metadata' | 'moderator' | 'news' | 'other']?: IUserWithoutRoles[];
  };
}

export function getTeam(): Response<GetTeamResponseBody> {
  return superagent.get('/api/team');
}

export function getUsersWithRoles(): Response<IUser[]> {
  return superagent.get('/api/users-with-permissions');
}

export function getMapperConsents(): Response<IMapperConsent[]> {
  return superagent.get('/api/mapper-consents');
}

export function lockNominations(roundId: number, gameMode: GameMode, lock: boolean): Response {
  return superagent.post('/api/lock-nominations').send({ roundId, gameMode, lock });
}

export function updateApiObject<T extends ApiObjectType>(type: T, id: number): Response {
  return superagent.post('/api/update-api-object').send({ type, id });
}

export function updateApiObjectBulk<T extends ApiObjectType>(type: T, ids: number[]): Response {
  return superagent.post('/api/update-api-object-bulk').send({ type, ids });
}

export function updateExcludedBeatmaps(
  nominationId: number,
  excludedBeatmapIds: number[],
): Response {
  return superagent
    .post('/api/update-excluded-beatmaps')
    .send({ nominationId, excludedBeatmapIds });
}

export function updateNominationAssignees(
  nominationId: number,
  type: AssigneeType,
  assigneeIds: number[],
): Response<PartialWithId<INomination>> {
  return superagent
    .post('/api/update-nomination-assignees')
    .send({ nominationId, type, assigneeIds });
}

export function updateNominationBeatmapset(
  nominationId: number,
  beatmapsetId: number,
): Response<PartialWithId<INomination>> {
  return superagent.post('/api/nomination-change-beatmapset').send({ beatmapsetId, nominationId });
}

export function updateNominationDescription(
  nominationId: number,
  description: string | null,
): Response<PartialWithId<INomination>> {
  return superagent.post('/api/nomination-edit-description').send({ description, nominationId });
}

export function updateNominationMetadata(
  nominationId: number,
  state: MetadataState,
  artist: string | null,
  title: string | null,
  creators: IUserWithoutRoles[] | undefined,
): Response<PartialWithId<INomination>> {
  return superagent
    .post('/api/nomination-edit-metadata')
    .send({ artist, creators, nominationId, state, title });
}

export function updateNominationModeration(
  nominationId: number,
  state: ModeratorState,
): Response<PartialWithId<INomination>> {
  return superagent.post('/api/nomination-edit-moderation').send({ nominationId, state });
}

export function updateNominationOrder(orders: Record<number, number>): Response {
  return superagent.post('/api/update-nomination-order').send(orders);
}

export function updateNominators(
  nominationId: number,
  nominatorIds: number[],
): Response<PartialWithId<INomination>> {
  return superagent.post('/api/update-nominators').send({ nominationId, nominatorIds });
}

export function updateRound(roundId: number, round: PartialWithoutId<IRound>): Response {
  return superagent.post('/api/update-round').send({ roundId, round });
}

export function updateSettings(settings: ISettings): Response<ISettings> {
  return superagent.put('/api/settings').send(settings);
}

export function updateUserRoles(userId: number, roles: IUser['roles']): Response {
  return superagent.post('/api/update-permissions').send({
    userId,
    ...roles,
    alumni_game_mode: roles.alumni_game_mode ?? null,
    captain_game_mode: roles.captain_game_mode ?? null,
  });
}

export function apiErrorMessage(error: ResponseError): string {
  return error.response?.body?.error ?? error.message;
}

type useApiReturn<T> = [
  T | undefined,
  ResponseError | undefined,
  Dispatch<SetStateAction<T | undefined>>,
];

export function useApi<T>(requester: () => Response<T>): useApiReturn<T>;
export function useApi<T, P extends unknown[]>(
  requester: (...args: P) => Response<T>,
  args: P,
  transform?: (body: T) => T,
  condition?: boolean,
): useApiReturn<T>;
export function useApi<T, P extends unknown[]>(
  requester: (...args: P) => Response<T>,
  args?: P,
  transform?: (body: T) => T,
  condition?: boolean,
): useApiReturn<T> {
  const [body, setBody] = useState<T>();
  const [error, setError] = useState<ResponseError>();

  useEffect(
    () => {
      if (condition === false) {
        setBody(undefined);
        setError(undefined);

        return;
      }

      (args == null ? requester(...([] as any)) : requester(...args))
        .then((response) => setBody(transform == null ? response.body : transform(response.body)))
        .catch((error) => setError(error));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    args == null ? [condition, requester] : [...args, condition, requester],
  );

  return [body, error, setBody];
}
