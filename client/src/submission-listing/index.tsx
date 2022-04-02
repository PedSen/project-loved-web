import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { Redirect, useHistory, useLocation, useParams } from 'react-router-dom';
import { apiErrorMessage, getSubmissions, useApi } from '../api';
import { dateFromString } from '../date-format';
import Help from '../Help';
import type { IReview } from '../interfaces';
import { Role } from '../interfaces';
import { GameMode } from '../interfaces';
import {
  gameModeFromShortName,
  gameModeLongName,
  gameModes,
  gameModeShortName,
} from '../osu-helpers';
import { useOsuAuth } from '../osuAuth';
import { hasRole } from '../permissions';
import useTitle from '../useTitle';
import type { ToggleableColumn, ToggleableColumnsState } from './helpers';
import { aggregateReviewScore } from './helpers';
import { toggleableColumns } from './helpers';
import type { SubmittedBeatmapset } from './interfaces';
import PageSelector from './PageSelector';
import SortButton from './SortButton';
import SubmissionBeatmapset from './SubmissionBeatmapset';

const messages = defineMessages({
  all: {
    defaultMessage: 'All',
    description: 'osu!mania key mode option for submissions table',
  },
  artist: {
    defaultMessage: 'Artist',
    description: 'Submissions table sort option',
  },
  bpm: {
    defaultMessage: 'BPM',
    description: 'Submissions table header',
  },
  difficultyCount: {
    defaultMessage: 'Diffs',
    description: 'Submissions table header',
  },
  favoriteCount: {
    defaultMessage: 'Favs',
    description: 'Submissions table header',
  },
  gameMode: {
    defaultMessage: 'Game mode:',
    description: 'Selector to change game mode',
  },
  keyModes: {
    defaultMessage: 'Keys',
    description: 'Submissions table header',
  },
  lovedAndRanked: {
    defaultMessage: 'Loved and ranked',
    description: 'Beatmap status option',
  },
  pendingAndGrave: {
    defaultMessage: 'Pending and grave',
    description: 'Beatmap status option',
  },
  playCount: {
    defaultMessage: 'Plays',
    description: 'Submissions table header',
  },
  priority: {
    defaultMessage: 'Priority',
    description: 'Submissions table header',
  },
  score: {
    defaultMessage: 'Score',
    description: 'Submissions table header',
  },
  scoreHelp: {
    defaultMessage: 'A placeholder method to sort this listing. {definition}',
    description: 'Help text for "Score" submissions table header',
  },
  status: {
    defaultMessage: 'Status',
    description: 'Submissions table header',
  },
  title: {
    defaultMessage: 'Title',
    description: 'Submissions table sort option',
  },
  year: {
    defaultMessage: 'Year',
    description: 'Submissions table header',
  },
  commonKeyModes: {
    defaultMessage: 'Common',
    description: 'osu!mania key mode option group for common key modes',
  },
  uncommonKeyModes: {
    defaultMessage: 'Uncommon',
    description: 'osu!mania key mode option group for uncommon key modes',
  },
});

const allBeatmapStatuses = ['pendingAndGrave', 'lovedAndRanked'] as const;
type BeatmapStatus = typeof allBeatmapStatuses[number];

const allSorts = [
  'artist',
  'title',
  'priority',
  'score',
  'playCount',
  'favoriteCount',
  'year',
] as const;
type Sort = typeof allSorts[number];

function getNewSubmissionsListingPath(
  gameMode: GameMode,
  keyMode: number | null,
  page: number,
): string {
  let path = `/submissions/${gameModeShortName(gameMode)}`;

  if (keyMode != null) {
    path += `/${keyMode}K`;
  }

  if (page > 1) {
    path += `/${page}`;
  }

  return path;
}

function columnsReducer(
  prevState: ToggleableColumnsState,
  column: ToggleableColumn,
): ToggleableColumnsState {
  return {
    ...prevState,
    [column]: !prevState[column],
  };
}

type SortsReducerAction =
  | {
      action: 'changeSort';
      index: 0 | 1;
      sort: Sort;
    }
  | {
      action: 'toggleOrder';
      index: 0 | 1;
    };
type SortsState = [
  {
    ascending: boolean;
    sort: Sort;
  },
  {
    ascending: boolean;
    sort: Sort;
  },
];

const defaultAscendingSorts = new Set<Sort>(['artist', 'title', 'year']);
const initialSortsState: SortsState = [
  {
    ascending: false,
    sort: 'priority',
  },
  {
    ascending: false,
    sort: 'score',
  },
];

function sortsReducer(prevSorts: SortsState, action: SortsReducerAction): SortsState {
  const sorts: SortsState = [{ ...prevSorts[0] }, { ...prevSorts[1] }];

  switch (action.action) {
    case 'changeSort':
      sorts[action.index] = {
        ascending: defaultAscendingSorts.has(action.sort),
        sort: action.sort,
      };

      if (action.index === 0) {
        const secondSort = action.sort === 'score' ? 'priority' : 'score';

        sorts[1] = {
          ascending: defaultAscendingSorts.has(secondSort),
          sort: secondSort,
        };
      }

      break;
    case 'toggleOrder':
      sorts[action.index].ascending = !sorts[action.index].ascending;
      break;
  }

  return sorts;
}

type SubmissionListingParams =
  | { gameMode: string | undefined; page: `${number}` | undefined }
  | {
      gameMode: `${'M' | 'm'}ania`;
      keyMode: `${number}${'K' | 'k'}`;
      page: `${number}` | undefined;
    };

export default function SubmissionListingContainer() {
  const history = useHistory();
  const intl = useIntl();
  const params = useParams<SubmissionListingParams>();
  const [beatmapStatus, setBeatmapStatus] = useState<BeatmapStatus>('pendingAndGrave');
  const [columns, toggleColumn] = useReducer(columnsReducer, {
    bpm: true,
    difficultyCount: true,
    favoriteCount: true,
    keyModes: true,
    playCount: true,
    score: true,
    year: true,
  });
  const [search, setSearch] = useState('');
  const [sorts, updateSort] = useReducer(sortsReducer, initialSortsState);
  const sortOptions = useMemo(
    () => [allSorts, allSorts.filter((sort) => sort !== sorts[0].sort)] as const,
    [sorts],
  );

  const gameMode = gameModeFromShortName(params.gameMode?.toLowerCase());
  const keyMode = 'keyMode' in params ? parseInt(params.keyMode) : null;
  const page = params.page == null ? 1 : parseInt(params.page);

  useTitle(
    gameMode == null
      ? null
      : `${keyMode == null ? '' : `${keyMode}K `}${gameModeLongName(gameMode)} submissions`,
  );

  if (gameMode == null) {
    return (
      <Redirect
        to={getNewSubmissionsListingPath(
          gameModeFromShortName(localStorage.getItem('gameMode')) ?? GameMode.osu,
          null,
          1,
        )}
      />
    );
  }

  const onGameModeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newGameMode = parseInt(event.currentTarget.value);

    if (newGameMode !== gameMode) {
      localStorage.setItem('gameMode', gameModeShortName(newGameMode));
      history.push(getNewSubmissionsListingPath(newGameMode, null, 1));
    }
  };
  const onKeyModeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newKeyMode =
      event.currentTarget.value === 'all' ? null : parseInt(event.currentTarget.value);

    if (newKeyMode !== keyMode) {
      history.push(getNewSubmissionsListingPath(gameMode, newKeyMode, 1));
    }
  };
  const resetPageComponent = () => {
    return <Redirect to={getNewSubmissionsListingPath(gameMode, keyMode, 1)} />;
  };
  const setPage = (newPage: number, replace?: boolean) => {
    if (newPage !== page) {
      if (replace) {
        history.replace(
          getNewSubmissionsListingPath(gameMode, keyMode, newPage),
          history.location.state,
        );
      } else {
        history.push(getNewSubmissionsListingPath(gameMode, keyMode, newPage));
      }
    }
  };

  // TODO: Controls break on languages with longer column names (fi, sv)
  return (
    <>
      <FormattedMessage
        defaultMessage='Submitted maps'
        description='Submissions table title'
        tagName='h1'
      />
      <div className='warning-box'>
        <FormattedMessage
          defaultMessage='
            This listing only includes submissions sent from this website. Entries from the old
            Google sheets will be moved here soon, and then the Google sheets will be retired.
          '
          description='Warning box above submissions table'
        />
      </div>
      <div className='block-margin'>
        <div className='flex-left'>
          <label htmlFor='gameMode'>{intl.formatMessage(messages.gameMode)}</label>
          <select name='gameMode' value={gameMode} onChange={onGameModeChange}>
            {gameModes.map((m) => (
              <option key={m} value={m}>
                {gameModeLongName(m)}
              </option>
            ))}
          </select>
          {gameMode === GameMode.mania && (
            <>
              <FormattedMessage
                defaultMessage='Key mode:'
                description='Selector to change osu!mania key mode'
                tagName='span'
              />
              <select value={keyMode ?? 'all'} onChange={onKeyModeChange}>
                <option value='all'>{intl.formatMessage(messages.all)}</option>
                <optgroup label={intl.formatMessage(messages.commonKeyModes)}>
                  {[4, 7].map((keyMode) => (
                    <option key={keyMode} value={keyMode}>
                      {keyMode}K
                    </option>
                  ))}
                </optgroup>
                <optgroup label={intl.formatMessage(messages.uncommonKeyModes)}>
                  {[1, 2, 3, 5, 6, 8, 9, 10].map((keyMode) => (
                    <option key={keyMode} value={keyMode}>
                      {keyMode}K
                    </option>
                  ))}
                </optgroup>
              </select>
            </>
          )}
          <FormattedMessage
            defaultMessage='Beatmap status:'
            description='Selector to change beatmap status'
            tagName='span'
          />
          <select
            value={beatmapStatus}
            onChange={(event) => {
              setBeatmapStatus(event.currentTarget.value as BeatmapStatus);
              setPage(1, true);
            }}
          >
            {allBeatmapStatuses.map((status) => (
              <option key={status} value={status}>
                {intl.formatMessage(messages[status])}
              </option>
            ))}
          </select>
          <FormattedMessage
            defaultMessage='Search:'
            description='Title for submissions search input'
            tagName='span'
          />
          <input
            type='search'
            className='flex-grow'
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setPage(1, true);
            }}
          />
        </div>
        <div className='flex-left slim-margin'>
          <FormattedMessage
            defaultMessage='Columns:'
            description='Title for options to show or hide columns'
            tagName='span'
          />
          <span className='flex-text'>
            {toggleableColumns.map(
              (column) =>
                (gameMode === GameMode.mania || column !== 'keyModes') && (
                  <button
                    key={column}
                    type='button'
                    className={`fake-a${columns[column] ? ' underline' : ''}`}
                    onClick={() => toggleColumn(column)}
                  >
                    {intl.formatMessage(messages[column])}
                  </button>
                ),
            )}
          </span>
          <FormattedMessage
            defaultMessage='Sort by:'
            description='Title for sorting options'
            tagName='span'
          />
          {sorts.map((sort, sortIndex) => (
            <span key={sortIndex}>
              <select
                value={sort.sort}
                onChange={(event) => {
                  updateSort({
                    action: 'changeSort',
                    index: sortIndex as 0 | 1,
                    sort: event.currentTarget.value as Sort,
                  });
                  setPage(1, true);
                }}
              >
                {sortOptions[sortIndex].map((sortOption) => (
                  <option key={sortOption} value={sortOption}>
                    {intl.formatMessage(
                      messages[
                        beatmapStatus === 'lovedAndRanked' && sortOption === 'priority'
                          ? 'status'
                          : sortOption
                      ],
                    )}
                  </option>
                ))}
              </select>{' '}
              <SortButton
                ascending={sort.ascending}
                toggle={() => {
                  updateSort({ action: 'toggleOrder', index: sortIndex as 0 | 1 });
                  setPage(1, true);
                }}
              />
            </span>
          ))}
        </div>
      </div>
      <SubmissionListing
        beatmapStatus={beatmapStatus}
        columns={columns}
        gameMode={gameMode}
        keyMode={keyMode}
        page={page}
        resetPageComponent={resetPageComponent}
        searchLowerCase={search.toLowerCase()}
        setPage={setPage}
        sorts={sorts}
      />
    </>
  );
}

function compareOrFallback<T>(a: T, b: T, hasProperty: (item: T) => boolean): number | null {
  const aHasProperty = hasProperty(a);
  return +aHasProperty - +hasProperty(b) || (aHasProperty ? 0 : null);
}

const beatmapsetSortFns: Record<
  Sort | 'status',
  (a: SubmittedBeatmapset, b: SubmittedBeatmapset) => number
> = {
  artist: (a, b) => a.artist.toLowerCase().localeCompare(b.artist.toLowerCase()),
  favoriteCount: (a, b) => a.favorite_count - b.favorite_count,
  playCount: (a, b) => a.play_count - b.play_count,
  priority: (a, b) =>
    compareOrFallback(a, b, (beatmapset) => beatmapset.nominated_round_name != null) ??
    compareOrFallback(
      b,
      a,
      (beatmapset) =>
        beatmapset.strictly_rejected ||
        beatmapset.consent === false ||
        beatmapset.creator.banned ||
        beatmapset.maximum_length < 30,
    ) ??
    compareOrFallback(b, a, (beatmapset) => beatmapset.poll != null && !beatmapset.poll.passed) ??
    compareOrFallback(b, a, (beatmapset) => beatmapset.reviews.length === 0) ??
    a.review_score - b.review_score,
  score: (a, b) => a.score - b.score,
  status: (a, b) => +(a.ranked_status === 4) - +(b.ranked_status === 4),
  title: (a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()),
  year: (a, b) =>
    dateFromString(a.submitted_at).getFullYear() - dateFromString(b.submitted_at).getFullYear(),
};

function beatmapsetSortFn(
  { ascending, sort }: SortsState[number],
  beatmapStatus: BeatmapStatus,
): (a: SubmittedBeatmapset, b: SubmittedBeatmapset) => number {
  return (a, b) =>
    (ascending ? 1 : -1) *
    beatmapsetSortFns[beatmapStatus === 'lovedAndRanked' && sort === 'priority' ? 'status' : sort](
      a,
      b,
    );
}

const pageSize = 30;

interface SubmissionListingProps {
  beatmapStatus: BeatmapStatus;
  columns: ToggleableColumnsState;
  gameMode: GameMode;
  keyMode: number | null;
  page: number;
  resetPageComponent: () => JSX.Element;
  searchLowerCase: string;
  setPage: (page: number, replace?: boolean) => void;
  sorts: SortsState;
}

function SubmissionListing({
  beatmapStatus,
  columns,
  gameMode,
  keyMode,
  page,
  resetPageComponent,
  searchLowerCase,
  setPage,
  sorts,
}: SubmissionListingProps) {
  const history = useHistory();
  const intl = useIntl();
  const { state: submittedBeatmapsetId } = useLocation<number | undefined>();
  const authUser = useOsuAuth().user;
  const [submissionsInfo, submissionsInfoError, setSubmissionsInfo] = useApi(getSubmissions, [
    gameMode,
  ]);
  const displayBeatmapsets = useMemo(() => {
    if (submissionsInfo == null) {
      return null;
    }

    // Beatmapsets come from API sorted by score descending
    return submissionsInfo.beatmapsets
      .filter(
        (beatmapset) =>
          (keyMode == null || beatmapset.key_modes.includes(keyMode)) &&
          (beatmapStatus === 'lovedAndRanked'
            ? beatmapset.ranked_status > 0
            : beatmapset.ranked_status <= 0) &&
          (searchLowerCase.length === 0 ||
            beatmapset.artist.toLowerCase().includes(searchLowerCase) ||
            beatmapset.creator_name.toLowerCase().includes(searchLowerCase) ||
            beatmapset.title.toLowerCase().includes(searchLowerCase)),
      )
      .map((beatmapset) => ({
        ...beatmapset,
        creator: submissionsInfo.usersById[beatmapset.creator_id],
      }))
      .sort(beatmapsetSortFn(sorts[1], beatmapStatus))
      .sort(beatmapsetSortFn(sorts[0], beatmapStatus))
      .sort((a, b) => +(b.poll?.in_progress ?? false) - +(a.poll?.in_progress ?? false));
  }, [beatmapStatus, keyMode, searchLowerCase, sorts, submissionsInfo]);

  useEffect(() => {
    if (displayBeatmapsets == null || submittedBeatmapsetId == null) {
      return;
    }

    const submittedBeatmapsetIndex = displayBeatmapsets.findIndex(
      (beatmapset) => beatmapset.id === submittedBeatmapsetId,
    );

    if (submittedBeatmapsetIndex < 0) {
      history.replace({});
      return;
    }

    const submittedBeatmapsetPage = Math.floor(submittedBeatmapsetIndex / pageSize) + 1;

    if (page !== submittedBeatmapsetPage) {
      setPage(submittedBeatmapsetPage, true);
      return;
    }

    document.querySelector(`[data-beatmapset-id="${submittedBeatmapsetId}"]`)?.scrollIntoView();
    history.replace({});
  }, [displayBeatmapsets, history, page, setPage, submittedBeatmapsetId]);

  if (submissionsInfoError != null) {
    return (
      <span className='panic'>
        Failed to load submissions: {apiErrorMessage(submissionsInfoError)}
      </span>
    );
  }

  if (submissionsInfo == null || displayBeatmapsets == null) {
    return <span>Loading submissions...</span>;
  }

  if (displayBeatmapsets.length === 0 && page === 1) {
    return (
      <p>
        <b>No submissions to show!</b>
      </p>
    );
  }

  const pageCount = Math.ceil(displayBeatmapsets.length / pageSize);

  if (page < 1 || page > pageCount) {
    return resetPageComponent();
  }

  const canReviewAny = authUser != null && hasRole(authUser, Role.captain, gameMode);
  const getOnReviewDelete = (beatmapsetId: number, reviewId: number) => () => {
    setSubmissionsInfo((prev) => {
      const beatmapset = prev!.beatmapsets.find((beatmapset) => beatmapset.id === beatmapsetId)!;

      beatmapset.reviews = beatmapset.reviews.filter((review) => review.id !== reviewId);
      beatmapset.review_score = aggregateReviewScore(beatmapset.reviews);
      beatmapset.review_score_all = aggregateReviewScore(beatmapset.reviews, true);
      beatmapset.strictly_rejected = beatmapset.reviews.some((review) => review.score < -3);

      return {
        beatmapsets: [...prev!.beatmapsets],
        usersById: prev!.usersById,
      };
    });
  };
  const onReviewUpdate = (review: IReview) => {
    setSubmissionsInfo((prev) => {
      const beatmapset = prev!.beatmapsets.find(
        (beatmapset) => beatmapset.id === review.beatmapset_id,
      )!;
      const existingReview = beatmapset.reviews.find((existing) => existing.id === review.id);

      if (existingReview != null) {
        Object.assign(existingReview, review);
      } else {
        beatmapset.reviews.push(review);
      }

      beatmapset.review_score = aggregateReviewScore(beatmapset.reviews);
      beatmapset.review_score_all = aggregateReviewScore(beatmapset.reviews, true);
      beatmapset.strictly_rejected = beatmapset.reviews.some((review) => review.score < -3);

      if (prev!.usersById[review.reviewer_id] == null) {
        prev!.usersById[review.reviewer_id] = { ...authUser! };
      }

      return {
        beatmapsets: [...prev!.beatmapsets],
        usersById: { ...prev!.usersById },
      };
    });
  };

  return (
    <>
      <PageSelector page={page} pageCount={pageCount} setPage={setPage} />
      <table className='main-table submissions-table'>
        <thead>
          <tr className='sticky'>
            <th />
            {gameMode === GameMode.mania && columns.keyModes && (
              <th>{intl.formatMessage(messages.keyModes)}</th>
            )}
            <FormattedMessage
              defaultMessage='Beatmapset'
              description='Submissions table header'
              tagName='th'
            />
            <FormattedMessage
              defaultMessage='Mapper'
              description='Submissions table header'
              tagName='th'
            />
            <th>
              {beatmapStatus === 'lovedAndRanked'
                ? intl.formatMessage(messages.status)
                : intl.formatMessage(messages.priority)}
            </th>
            {columns.score && (
              <th>
                {intl.formatMessage(messages.score)}{' '}
                <Help>
                  {intl.formatMessage(messages.scoreHelp, {
                    definition: `${intl.formatMessage(messages.score)} = ${intl.formatMessage(
                      messages.favoriteCount,
                    )} × 75 + ${intl.formatMessage(messages.playCount)}`,
                  })}
                </Help>
              </th>
            )}
            {columns.playCount && <th>{intl.formatMessage(messages.playCount)}</th>}
            {columns.favoriteCount && <th>{intl.formatMessage(messages.favoriteCount)}</th>}
            {columns.year && <th>{intl.formatMessage(messages.year)}</th>}
            {columns.difficultyCount && <th>{intl.formatMessage(messages.difficultyCount)}</th>}
            {columns.bpm && <th>{intl.formatMessage(messages.bpm)}</th>}
          </tr>
        </thead>
        <tbody>
          {displayBeatmapsets.slice((page - 1) * pageSize, page * pageSize).map((beatmapset) => {
            const canReview = canReviewAny && beatmapset.ranked_status <= 0;
            const review = canReview
              ? beatmapset.reviews.find((review) => review.reviewer_id === authUser!.id)
              : undefined;

            return (
              <SubmissionBeatmapset
                key={beatmapset.id}
                beatmapset={beatmapset}
                canReview={canReview}
                columns={columns}
                gameMode={gameMode}
                onReviewDelete={review == null ? null : getOnReviewDelete(beatmapset.id, review.id)}
                onReviewUpdate={onReviewUpdate}
                review={review}
                showStatus={beatmapStatus === 'lovedAndRanked'}
                usersById={submissionsInfo.usersById}
              />
            );
          })}
        </tbody>
      </table>
      <PageSelector page={page} pageCount={pageCount} setPage={setPage} />
    </>
  );
}
