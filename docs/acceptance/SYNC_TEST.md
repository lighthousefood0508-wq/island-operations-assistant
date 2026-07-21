# ROS 同步測試

Approval Record: DECISIONS #016

本清單只驗證 ROS Shadow Run 的同步穩定性。Legacy 仍是正式系統，測試時不要停止、修改或重啟 Legacy。

## 開始前

1. 在 Windows 主機啟動 ROS，確認 `http://主機IP:3090/health` 回傳 `ok`。
2. 建立並開啟一個測試場次，至少設定一個 POS 商品與 3 份可售量。
3. 在三台裝置或三個瀏覽器分別開啟：
   - `http://主機IP:3090/pos?device=POS-A&debug=1`
   - `http://主機IP:3090/pos?device=POS-B&debug=1`
   - `http://主機IP:3090/kitchen?device=Kitchen-A&debug=1`
   - 可另開 `http://主機IP:3090/pos/statistics?device=Statistics&debug=1`
4. 每個頁面頂端都應顯示 `🟢 Connected`。按 `Debug Mode` 可查看 Device、Event、SSE、Polling、Last Sync、Reconnect Count、Server Time 與 SQLite 狀態。

## 基本同步

1. POS-A 建立一張測試訂單。
2. 不重新整理 POS-B、Kitchen-A、Statistics。
3. POS-B 與 Kitchen-A 應出現相同叫號；Statistics 的中央訂單數與商品數量應更新。
4. Kitchen-A 依序按「開始製作」、「餐點完成」、「確認取餐」。
5. 每一步後 POS-A 與 POS-B 都應自動更新為製作中、可取餐、已出餐。

## 斷線與恢復

1. 在其中一台裝置暫時關閉網路，畫面應顯示 `🔴 Offline`，且不可假裝送單或更新成功。
2. 恢復網路後，畫面會先顯示 `🟡 Reconnecting`，再回到 `🟢 Connected`。
3. 無需 F5；恢復後應重新讀取中央 SQLite 的最新訂單、剩餘份數與製作狀態。
4. 觀察 Debug Mode：Reconnect Count 增加、Last Sync 更新，且不會多出重複訂單。

## Node 重啟演練

1. 僅在測試時，先確認 Legacy 正常且不受影響。
2. 停止 ROS Node 服務，所有 ROS 頁面應顯示 Offline 或 Reconnecting。
3. 以原本 ROS 指令重新啟動 Node 服務。
4. 每個頁面應自動重新連上 SSE 並重新讀取中央資料，不需要手動重新整理。
5. 再建立一張測試單，確認 POS、Kitchen、Statistics 一致；不得出現重複叫號或重複扣量。

## 判定失敗

以下任一項即記錄為 Shadow Run 問題：不同裝置訂單不同、Kitchen 狀態未回到 POS、Statistics 要 F5 才更新、離線時誤顯示成功、恢復後重複訂單，或 Debug Mode 顯示的 Event 不一致。
