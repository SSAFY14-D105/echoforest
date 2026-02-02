import Phaser from 'phaser';

/**
 * TiledHelper
 * Tiled Map 데이터 파싱을 위한 유틸리티 함수 모음
 */
export default class TiledHelper {

    /**
     * GID를 기반으로 타일셋에서 커스텀 충돌 데이터(Object Group)를 추출합니다.
     */
    public static getCollisionDataForGID(map: Phaser.Tilemaps.Tilemap, gid: number): any[] | null {
        if (gid <= 0) return null;

        const tileset = map.tilesets.find(ts =>
            gid >= ts.firstgid && gid < ts.firstgid + ts.total
        );

        if (!tileset) return null;

        const tileIndex = gid - tileset.firstgid;

        // @ts-ignore - Phaser 타입 정의 누락 대응
        const tileData = tileset.getTileData(tileIndex) || (tileset.tileData && tileset.tileData[tileIndex]);

        if (tileData && tileData.objectgroup && tileData.objectgroup.objects) {
            return tileData.objectgroup.objects;
        }

        return null;
    }

    /**
     * Tiled Object에서 특정 속성 값을 추출합니다.
     */
    public static getObjectProperty(obj: Phaser.Types.Tilemaps.TiledObject, name: string): any {
        if (obj.properties) {
            if (Array.isArray(obj.properties)) {
                return obj.properties.find((p: any) => p.name === name)?.value;
            } else {
                return (obj.properties as any)[name];
            }
        }
        return undefined;
    }

    /**
     * Tiled Object의 모든 속성을 객체 형태로 반환합니다.
     */
    public static getAllObjectProperties(obj: Phaser.Types.Tilemaps.TiledObject): any {
        const props: any = {};
        if (obj.properties) {
            if (Array.isArray(obj.properties)) {
                obj.properties.forEach((p: any) => props[p.name] = p.value);
            } else {
                Object.assign(props, obj.properties);
            }
        }
        return props;
    }

    /**
     * 레이어 속성을 추출합니다.
     */
    public static getLayerProperty(layer: any, name: string): any {
        if (layer.properties) {
            if (Array.isArray(layer.properties)) {
                return layer.properties.find((p: any) => p.name === name)?.value;
            } else {
                return layer.properties[name];
            }
        }
        return undefined;
    }
}
