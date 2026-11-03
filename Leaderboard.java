
package com.example;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.google.gson.Gson;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.ScanRequest;
import software.amazon.awssdk.services.dynamodb.model.ScanResponse;

import java.util.*;

public class Leaderboard implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {

    private static final DynamoDbClient db = DynamoDbClient.create();
    private static final Gson gson = new Gson();

    @Override
    public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent event, Context context) {

        ScanRequest request = ScanRequest.builder()
            .tableName("users")
            .projectionExpression("#u, #s")
            .expressionAttributeNames(Map.of("#u", "username", "#s", "score"))
            .build();
        
        List<Map<String, Object>> rows = new ArrayList<>();
        for (ScanResponse page : db.scanPaginator(request)) {
            for (Map<String, AttributeValue> item : page.items()) {
                Map<String, Object> row = new HashMap<>();
                row.put("username", item.get("username").s());
                row.put("score", Double.parseDouble(item.get("score").n()));
                rows.add(row);
            }
        }

        rows.sort((a, b) -> Double.compare((double) b.get("score"), (double) a.get("score")));

        return APIGatewayV2HTTPResponse.builder()
            .withStatusCode(200)
            .withHeaders(Map.of(
                "Content-Type", "application/json",
                "Access-Control-Allow-Origin", "*"))
            .withBody(gson.toJson(rows))
            .build();
    }
}
