import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export type UserRecord = {
  id: string;
  provider: string;
  providerUserId: string;
  email: string | null;
  roles: string[];
  sessionVersion: number;
  createdAt: number;
  updatedAt: number;
};

export type UserRepo = {
  getUser(id: string): Promise<UserRecord | null>;
  saveUser(record: UserRecord): Promise<UserRecord>;
  findUserByProvider(
    provider: string,
    providerUserId: string
  ): Promise<UserRecord | null>;
};

export function createUserRepo(input: {
  ddb: DynamoDBClient;
  tableName: string;
}): UserRepo {
  const { ddb, tableName } = input;

  async function getUser(id: string): Promise<UserRecord | null> {
    const res = await ddb.send(
      new GetItemCommand({ TableName: tableName, Key: marshall({ id }) })
    );
    if (!res.Item) return null;
    return unmarshall(res.Item) as UserRecord;
  }

  async function saveUser(record: UserRecord): Promise<UserRecord> {
    await ddb.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(record, { removeUndefinedValues: true }),
      })
    );
    return record;
  }

  async function findUserByProvider(
    provider: string,
    providerUserId: string
  ): Promise<UserRecord | null> {
    const res = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "#provider = :provider AND providerUserId = :pid",
        ExpressionAttributeNames: { "#provider": "provider" },
        ExpressionAttributeValues: marshall({
          ":provider": provider,
          ":pid": providerUserId,
        }),
        Limit: 1,
      })
    );
    const items = res.Items || [];
    if (!items[0]) return null;
    return unmarshall(items[0]) as UserRecord;
  }

  return { getUser, saveUser, findUserByProvider };
}
