import mongoose, { PipelineStage } from "mongoose";

/**
 * The only thing a ThreadCard needs to know about a thread's likes and comments.
 *
 * `likes` and `children` are unbounded arrays embedded in the thread document.
 * Rendering a card reads four scalars off them — a count, a boolean, a count,
 * and two avatars — so shipping the arrays themselves means a popular thread
 * slows down every feed that contains it. These fields are derived in the
 * database and the arrays are dropped before anything crosses the wire.
 */
export interface ThreadCardFields {
  likesCount: number;
  likedByMe: boolean;
  commentsCount: number;
  /** Up to two commenter avatars — the only part of `children` a card renders. */
  commentImages: string[];
}

function toObjectId(id?: string | null) {
  return id && mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : null;
}

/**
 * Pipeline stages that turn raw thread documents into ThreadCard-shaped ones.
 *
 * Append these *after* $match/$sort/$skip/$limit. Stage order is the whole
 * point: the $lookups below run once per surviving document, so limiting first
 * means joining 30 documents instead of the entire collection.
 *
 * Requires MongoDB 5.0+ ($lookup with localField/foreignField *and* pipeline).
 */
export function threadCardStages(viewerId?: string | null): PipelineStage[] {
  const viewer = toObjectId(viewerId);

  return [
    {
      $addFields: {
        likesCount: { $size: { $ifNull: ["$likes", []] } },
        // "$likes.userId" projects the subdocument array down to its ids, so
        // membership is one $in rather than a scan shipped to Node.
        likedByMe: viewer
          ? { $in: [viewer, { $ifNull: ["$likes.userId", []] }] }
          : false,
        commentsCount: { $size: { $ifNull: ["$children", []] } },
        previewChildIds: { $slice: [{ $ifNull: ["$children", []] }, 2] },
      },
    },

    // Drop the unbounded arrays the moment the scalars exist. Every stage after
    // this one — and the network, and the RSC payload — works on bounded data.
    { $project: { likes: 0, children: 0 } },

    {
      $lookup: {
        from: "users",
        localField: "author",
        foreignField: "_id",
        as: "author",
        // Without this the card drags along the author's bio, communities and
        // entire threads array to render a name and an avatar.
        pipeline: [{ $project: { _id: 1, id: 1, name: 1, image: 1 } }],
      },
    },
    { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "communities",
        localField: "community",
        foreignField: "_id",
        as: "community",
        pipeline: [{ $project: { _id: 1, id: 1, name: 1, image: 1 } }],
      },
    },
    { $unwind: { path: "$community", preserveNullAndEmptyArrays: true } },

    // previewChildIds holds ObjectIds, not authors — resolve the two of them to
    // avatars. Bounded at two rows, so the nested lookup stays cheap.
    {
      $lookup: {
        from: "threads",
        localField: "previewChildIds",
        foreignField: "_id",
        as: "previewChildren",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "author",
              pipeline: [{ $project: { image: 1 } }],
            },
          },
          { $project: { image: { $arrayElemAt: ["$author.image", 0] } } },
        ],
      },
    },

    {
      $project: {
        text: 1,
        parentId: 1,
        createdAt: 1,
        tags: 1,
        author: 1,
        community: 1,
        likesCount: 1,
        likedByMe: 1,
        commentsCount: 1,
        commentImages: {
          $filter: {
            input: "$previewChildren.image",
            as: "image",
            cond: { $ne: ["$$image", null] },
          },
        },
      },
    },
  ];
}

/**
 * The same four fields, derived in JS from an already-populated thread.
 *
 * Used only by the thread detail page, which legitimately renders every comment
 * and so has the arrays in memory anyway. Keeping it here means both paths
 * produce one prop shape and ThreadCard never has to branch.
 */
export function toThreadCardFields(
  thread: any,
  viewerId?: string | null
): ThreadCardFields {
  const likes: any[] = Array.isArray(thread?.likes) ? thread.likes : [];
  const children: any[] = Array.isArray(thread?.children) ? thread.children : [];

  return {
    likesCount: likes.length,
    likedByMe:
      Boolean(viewerId) &&
      likes.some((like) => String(like?.userId ?? like) === viewerId),
    commentsCount: children.length,
    commentImages: children
      .slice(0, 2)
      .map((child) => child?.author?.image)
      .filter(Boolean),
  };
}
